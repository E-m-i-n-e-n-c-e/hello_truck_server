import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { BookingNotificationService } from './booking-notification.service';
import { Booking, BookingStatus, Customer, Invoice, PaymentMethod, Prisma, RefundIntent, TransactionCategory, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { truncateDecimal, toDecimal, toNumber } from '../utils/decimal.utils';
import { REALTIME_BUS, RealtimeBus } from 'src/redis/interfaces/realtime-bus.interface';

/**
 * Service for handling all refund operations
 */
@Injectable()
export class BookingRefundService {
  private readonly logger = new Logger(BookingRefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly notificationService: BookingNotificationService,
    private readonly configService: ConfigService,
    @Inject(REALTIME_BUS) private readonly realtimeBus: RealtimeBus,
  ) {}

  /**
   * Create refund intent for async processing
   * Called within cancellation transaction
   */
  async createRefundIntent(
    booking: Booking & { customer: Customer },
    finalInvoice: Invoice,
    tx: Prisma.TransactionClient,
  ): Promise<RefundIntent> {
    const { walletRefund, razorpayRefund, cancellationCharge, refundFactor } =
      await this.calculateRefundAmounts(booking, finalInvoice);

    // Determine status:
    // - PENDING if there's a refund to process OR cancellation charge to deduct
    // - NOT_REQUIRED if no refund and no cancellation charge
    const hasPendingAction =
      walletRefund.greaterThan(0) ||
      razorpayRefund.greaterThan(0) ||
      (!finalInvoice.isPaid && cancellationCharge.greaterThan(0));

    return tx.refundIntent.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId!,
        walletRefundAmount: toNumber(walletRefund),
        razorpayRefundAmount: toNumber(razorpayRefund),
        cancellationCharge: toNumber(cancellationCharge),
        refundFactor: refundFactor ? toNumber(refundFactor) : null,
        wasPaid: finalInvoice.isPaid,
        rzpPaymentId: finalInvoice.rzpPaymentId ?? undefined,
        status: hasPendingAction ? 'PENDING' : 'NOT_REQUIRED',
      }
    });
  }

  /**
   * Process refund intent (called by cron or async trigger)
   * Handles BOTH wallet credit AND Razorpay refund
   */
  async processRefundIntent(intentId: string): Promise<void> {
    // Atomic claim: Mark as PROCESSING only if still PENDING (prevents race condition)
    const claimed = await this.prisma.refundIntent.updateMany({
      where: {
        id: intentId,
        status: 'PENDING',
      },
      data: { status: 'PROCESSING' },
    });

    if (claimed.count === 0) {
      this.logger.log(`Refund intent ${intentId} already claimed by another instance`);
      return;
    }

    // Fetch intent with booking data after claiming
    const intent = await this.prisma.refundIntent.findUniqueOrThrow({
      where: { id: intentId },
      include: {
        booking: {
          include: {
            customer: true,
            assignedDriver: true,
          }
        }
      },
    });

    try {
      // Execute Razorpay refund FIRST (money movement)
      let rzpRefundId: string | null = null;
      if (Number(intent.razorpayRefundAmount) > 0 && intent.rzpPaymentId) {
        rzpRefundId = await this.executeRazorpayRefund(
          intent.booking,
          intent.rzpPaymentId,
          Number(intent.razorpayRefundAmount),
          'Booking cancelled',
        );
      }

      // Then update DB
      let driverCompensation = 0;
      await this.prisma.$transaction(async (tx) => {
        // Fetch fresh booking data inside transaction to avoid stale data
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: intent.bookingId },
          include: { customer: true, assignedDriver: true },
        });

        // Credit wallet refund (can be negative if customer had debt)
        if (Number(intent.walletRefundAmount) !== 0 && booking.customer) {
          const newBalance = await this.updateCustomerWallet(
            intent.customerId,
            booking as Booking & { customer: Customer },
            Number(intent.walletRefundAmount),
            `Refund for cancelled Booking #${booking.bookingNumber}`,
            tx,
            intentId,
          );
          // Update booking object with new balance for next operation
          booking.customer.walletBalance = new Decimal(newBalance);
        }

        // Handle UNPAID invoice: Deduct cancellation charge from wallet
        if (!intent.wasPaid && Number(intent.cancellationCharge) > 0 && booking.customer) {
          const chargeAmount = -Number(intent.cancellationCharge); // Negative for debit
          await this.updateCustomerWallet(
            intent.customerId,
            booking as Booking & { customer: Customer },
            chargeAmount,
            `Cancellation charge for Booking #${booking.bookingNumber}`,
            tx,
            intentId,
          );
        }

        // Process driver compensation if there's a cancellation charge and driver was assigned
        if (Number(intent.cancellationCharge) > 0 && booking.assignedDriver) {
          driverCompensation = await this.compensateDriver(
            booking.assignedDriver,
            booking,
            Number(intent.cancellationCharge),
            tx,
          );
        }

        // Create transaction record for Razorpay refund
        if (rzpRefundId) {
          await tx.transaction.create({
            data: {
              customerId: intent.customerId,
              bookingId: intent.bookingId,
              paymentMethod: PaymentMethod.ONLINE,
              amount: intent.razorpayRefundAmount,
              type: TransactionType.CREDIT, // Customer receives refund = CREDIT (money IN)
              category: TransactionCategory.BOOKING_REFUND,
              description: `Refund for cancelled booking #${booking.bookingNumber}`,
              refundIntentId: intentId,
            },
          });
        }

        // Mark as completed
        await tx.refundIntent.update({
          where: { id: intentId },
          data: {
            status: 'COMPLETED',
            rzpRefundId,
            processedAt: new Date(),
          },
        });
      });

      this.logger.log(`✓ Refund processed: ${intentId}`);

      // Notify customer
      if (intent.wasPaid) {
        // Notify about refund for paid invoices (wallet or Razorpay)
        if (Number(intent.walletRefundAmount) > 0 || Number(intent.razorpayRefundAmount) > 0) {
          this.notificationService.notifyCustomerRefundProcessed(
            intent.customerId,
            intent.booking.bookingNumber,
          );
        }
      } else if (Number(intent.cancellationCharge) > 0) {
        // Notify about cancellation charge for unpaid invoices
        this.notificationService.notifyCustomerCancellationCharge(
          intent.customerId,
          Number(intent.cancellationCharge),
        );
      }

      // Notify driver about compensation if applicable
      if (driverCompensation > 0 && intent.booking.assignedDriver) {
        this.notificationService.notifyDriverCompensation(
          intent.booking.assignedDriver.id,
          driverCompensation,
        );
      }

    } catch (error) {
      this.logger.error(`✗ Refund FAILED: ${intentId} ${error.message}`);
      // Retry logic
      const newRetryCount = intent.retryCount + 1;

      try {
        // Try to update refund intent status for retry
        await this.prisma.refundIntent.update({
          where: { id: intentId },
          data: {
            status: newRetryCount >= intent.maxRetries ? 'FAILED' : 'PENDING',
            failureReason: error.message,
            retryCount: newRetryCount,
          },
        });

        if (newRetryCount >= intent.maxRetries) {
          this.logger.error(`✗ Refund FAILED after max retries: ${intentId}`);
        } else {
          this.logger.warn(`Refund retry ${newRetryCount}/${intent.maxRetries} for ${intentId}`);
        }
      } catch (updateError) {
        this.logger.error(`Failed to update refund intent ${intentId} retry status: ${updateError.message}`);
      }
    }
  }

  /**
   * Calculate refund amounts based on booking status and km travelled
   * Cancellation charge increases with distance for CONFIRMED/PICKUP_ARRIVED
   */
  async calculateRefundAmounts(
    booking: Booking,
    invoice: Invoice,
  ): Promise<{
    walletRefund: Decimal;
    razorpayRefund: Decimal;
    cancellationCharge: Decimal;
    refundFactor: Decimal | null;
  }> {
    // Use basePrice for cancellation charge (not effectiveBasePrice which includes weight)
    // Cancellation happens before pickup, so weight doesn't matter
    const basePrice = toDecimal(invoice.basePrice);
    const walletApplied = toDecimal(invoice.walletApplied);
    const totalPayable = toDecimal(invoice.finalAmount);
    const isPaid = invoice.isPaid;

    // Full refund for PENDING and DRIVER_ASSIGNED
    if (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.DRIVER_ASSIGNED) {
      return {
        walletRefund: truncateDecimal(walletApplied),
        razorpayRefund: truncateDecimal(totalPayable),
        cancellationCharge: new Decimal(0),
        refundFactor: null,
      };
    }

    // Partial refund for CONFIRMED and PICKUP_ARRIVED
    if (booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.PICKUP_ARRIVED) {
      const minCharge = new Decimal(this.configService.get<number>('CANCELLATION_MIN_CHARGE_PERCENT') ?? 0.1);
      const maxCharge = new Decimal(this.configService.get<number>('CANCELLATION_MAX_CHARGE_PERCENT') ?? 0.5);
      const incrementPerKm = new Decimal(this.configService.get<number>('CANCELLATION_CHARGE_INCREMENT_PER_KM') ?? 0.05);

      // Charge percentage starts at minCharge and INCREASES with distance
      let chargePercentage = minCharge;

      // Read kmTravelled from Redis (driver navigation data)
      if (booking.assignedDriverId) {
        try {
          const cacheKey = `driver_navigation:${booking.assignedDriverId}`;
          const navigationDataStr = await this.realtimeBus.get(cacheKey);

          if (navigationDataStr) {
            const navigationData = JSON.parse(navigationDataStr);

            // Only use kmTravelled if it's for the same booking
            if (navigationData.bookingId === booking.id) {
              const kmTravelled = navigationData.kmTravelled || 0;
              const increment = incrementPerKm.mul(kmTravelled);
              chargePercentage = Decimal.min(maxCharge, minCharge.plus(increment));
              this.logger.log(`Booking ${booking.id}: ${kmTravelled}km travelled, charge: ${chargePercentage.mul(100).toFixed(1)}%`);
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to read navigation data for booking ${booking.id}, using min charge: ${error.message}`);
        }
      }

      // Refund percentage DECREASES as charge increases
      const refundPercentage = new Decimal(1).minus(chargePercentage);
      const cancellationCharge = truncateDecimal(basePrice.mul(chargePercentage));

      // Calculate refunds with proportional distribution of cancellation charge
      // Each payment method bears its share of the charge based on contribution to total
      if (isPaid) {
        const totalPaid = walletApplied.plus(totalPayable);

        // Proportional deduction: each method loses (cancellationCharge × itsContribution / totalPaid)
        const walletShare = totalPaid.greaterThan(0)
          ? cancellationCharge.mul(walletApplied).div(totalPaid)
          : new Decimal(0);
        const razorpayShare = totalPaid.greaterThan(0)
          ? cancellationCharge.mul(totalPayable).div(totalPaid)
          : new Decimal(0);

        return {
          walletRefund: truncateDecimal(walletApplied.minus(walletShare)),
          razorpayRefund: truncateDecimal(totalPayable.minus(razorpayShare)),
          cancellationCharge,
          refundFactor: refundPercentage,
        };
      }

      // Unpaid: full wallet refund, no razorpay refund
      return {
        walletRefund: truncateDecimal(walletApplied),
        razorpayRefund: new Decimal(0),
        cancellationCharge,
        refundFactor: refundPercentage,
      };
    }

    // No refund for other statuses
    return {
      walletRefund: isPaid ? new Decimal(0) : truncateDecimal(walletApplied),
      razorpayRefund: new Decimal(0),
      cancellationCharge: truncateDecimal(basePrice),
      refundFactor: new Decimal(0),
    };
  }

  /**
   * Update customer wallet (credit or debit)
   * Positive amount = credit (refund), Negative amount = debit (cancellation charge)
   */
  private async updateCustomerWallet(
    customerId: string,
    booking: Booking & { customer: Customer },
    amount: number,
    reason: string,
    tx: Prisma.TransactionClient,
    refundIntentId: string,
  ): Promise<number> {
    if (amount === 0) return Number(booking.customer.walletBalance);

    const walletBefore = toDecimal(booking.customer.walletBalance);
    const amountDecimal = toDecimal(amount);
    const newBalance = truncateDecimal(walletBefore.plus(amountDecimal));

    await tx.customer.update({
      where: { id: customerId },
      data: { walletBalance: toNumber(newBalance) },
    });

    await tx.customerWalletLog.create({
      data: {
        customerId,
        beforeBalance: toNumber(walletBefore),
        afterBalance: toNumber(newBalance),
        amount: toNumber(truncateDecimal(amountDecimal)),
        reason,
        bookingId: booking.id,
        refundIntentId,
      },
    });

    const action = amount > 0 ? 'Credited' : 'Debited';
    this.logger.log(`${action} ₹${Math.abs(amount)} ${amount > 0 ? 'to' : 'from'} customer ${customerId} wallet`);

    return toNumber(newBalance);
  }

  /**
   * Compensate driver from cancellation charge
   * Uses stored commission rate from assignment if available
   */
  private async compensateDriver(
    driver: { id: string; walletBalance: any },
    booking: Booking,
    cancellationCharge: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    if (cancellationCharge <= 0) return 0;

    const driverWalletBefore = toDecimal(driver.walletBalance);
    const chargeDecimal = toDecimal(cancellationCharge);

    // Try to get commission rate from the accepted assignment
    const assignment = await tx.bookingAssignment.findFirst({
      where: {
        bookingId: booking.id,
        driverId: driver.id,
        status: 'ACCEPTED',
      },
    });

    // Use stored commission rate if available, otherwise fall back to env config
    // Note: commissionRate field added in migration - may be null for older assignments
    const storedRate = assignment?.commissionRate;
    const commissionRate = storedRate
      ? toDecimal(storedRate)
      : toDecimal(this.configService.get<number>('COMMISSION_RATE') || 0.07);

    const compensation = truncateDecimal(chargeDecimal.mul(new Decimal(1).minus(commissionRate)));

    const newBalance = truncateDecimal(driverWalletBefore.plus(compensation));

    await tx.driver.update({
      where: { id: driver.id },
      data: { walletBalance: toNumber(newBalance) },
    });

    await tx.driverWalletLog.create({
      data: {
        driverId: driver.id,
        beforeBalance: toNumber(driverWalletBefore),
        afterBalance: toNumber(newBalance),
        amount: toNumber(compensation),
        reason: `Cancellation compensation for Booking #${booking.bookingNumber}`,
        bookingId: booking.id,
      },
    });

    this.logger.log(`Compensated driver ${driver.id} with ₹${toNumber(compensation)} for cancellation`);
    return toNumber(compensation);
  }

  /**
   * Execute Razorpay refund with idempotency check
   * Returns rzpRefundId or null
   */
  private async executeRazorpayRefund(
    booking: Booking,
    rzpPaymentId: string,
    amount: number,
    reason: string,
  ): Promise<string | null> {
    if (amount <= 0 || !rzpPaymentId) return null;

    try {
      // Check if refund already exists (idempotency)
      const existingRefunds = await this.razorpayService.fetchRefunds(rzpPaymentId);
      const matchedRefund = existingRefunds.find(r =>
        r.amount === amount &&
        r.notes?.bookingId === booking.id
      );

      if (matchedRefund) {
        this.logger.warn(`Refund already exists on Razorpay (ID: ${matchedRefund.refundId})`);
        return matchedRefund.refundId;
      }

      // Create new refund
      const refund = await this.razorpayService.createRefund({
        paymentId: rzpPaymentId,
        amount,
        notes: {
          bookingId: booking.id,
          reason: reason || 'Booking cancelled',
        },
      });

      this.logger.log(`Razorpay refund created: ₹${amount} for booking ${booking.id}`);
      return refund.refundId;

    } catch (error) {
      this.logger.error(`Razorpay refund failed: ${error.message}`);
      throw error;
    }
  }
}
