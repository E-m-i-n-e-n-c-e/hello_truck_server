import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { BookingNotificationService } from './booking-notification.service';
import { Booking, BookingStatus, Customer, Invoice, PaymentMethod, Prisma, RefundIntent, TransactionCategory, TransactionType } from '@prisma/client';
import { truncate2 } from '../utils/general.utils';

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
    const { walletRefund, razorpayRefund, cancellationCharge } =
      this.calculateRefundAmounts(booking.status, finalInvoice, booking.acceptedAt);

    // Determine status:
    // - PENDING if there's a refund to process OR cancellation charge to deduct
    // - NOT_REQUIRED if no refund and no cancellation charge
    const hasPendingAction =
      walletRefund > 0 ||
      razorpayRefund > 0 ||
      (!finalInvoice.isPaid && cancellationCharge > 0);

    return tx.refundIntent.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId!,
        walletRefundAmount: walletRefund,
        razorpayRefundAmount: razorpayRefund,
        cancellationCharge,
        wasPaid: finalInvoice.isPaid, // Store payment status
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

        // Handle PAID invoice: Credit wallet with refund
        if (Number(intent.walletRefundAmount) > 0 && booking.customer) {
          await this.updateCustomerWallet(
            intent.customerId,
            booking as Booking & { customer: Customer },
            Number(intent.walletRefundAmount),
            `Refund for cancelled Booking #${booking.bookingNumber}`,
            tx,
            intentId,
          );
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
   * Calculate refund amounts based on booking status and time elapsed
   * Cancellation charge increases with time for CONFIRMED/PICKUP_ARRIVED
   */
  calculateRefundAmounts(
    status: BookingStatus,
    invoice: Invoice,
    acceptedAt?: Date | null,
  ): {
    walletRefund: number;
    razorpayRefund: number;
    cancellationCharge: number;
  } {
    const walletApplied = Number(invoice.walletApplied);
    const finalAmount = Number(invoice.finalAmount);
    const totalPaid = walletApplied + finalAmount;

    // Full refund for PENDING and DRIVER_ASSIGNED
    if (status === BookingStatus.PENDING || status === BookingStatus.DRIVER_ASSIGNED) {
      return {
        walletRefund: truncate2(walletApplied),
        razorpayRefund: truncate2(finalAmount),
        cancellationCharge: 0,
      };
    }

    // Partial refund for CONFIRMED and PICKUP_ARRIVED
    if (status === BookingStatus.CONFIRMED || status === BookingStatus.PICKUP_ARRIVED) {
      const minCharge = this.configService.get<number>('CANCELLATION_MIN_CHARGE_PERCENT') || 0.1;
      const maxCharge = this.configService.get<number>('CANCELLATION_MAX_CHARGE_PERCENT') || 0.5;
      const incrementPerMinute = this.configService.get<number>('CANCELLATION_CHARGE_INCREMENT_PER_MINUTE') || 0.01;

      let refundPercentage = minCharge;

      if (acceptedAt) {
        const minutesElapsed = Math.floor((Date.now() - new Date(acceptedAt).getTime()) / (1000 * 60));
        refundPercentage = Math.min(
          maxCharge,
          minCharge + (minutesElapsed * incrementPerMinute)
        );
      } else {
        refundPercentage = minCharge;
      }

      return {
        walletRefund: truncate2(walletApplied * refundPercentage),
        razorpayRefund: truncate2(finalAmount * refundPercentage),
        cancellationCharge: truncate2(totalPaid * (1 - refundPercentage)),
      };
    }

    // No refund for other statuses
    return {
      walletRefund: 0,
      razorpayRefund: 0,
      cancellationCharge: truncate2(totalPaid),
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
  ): Promise<void> {
    if (amount === 0) return;

    const walletBefore = Number(booking.customer.walletBalance);
    const newBalance = truncate2(walletBefore + amount);

    await tx.customer.update({
      where: { id: customerId },
      data: { walletBalance: newBalance },
    });

    await tx.customerWalletLog.create({
      data: {
        customerId,
        beforeBalance: walletBefore,
        afterBalance: newBalance,
        amount: truncate2(amount),
        reason,
        bookingId: booking.id,
        refundIntentId,
      },
    });

    const action = amount > 0 ? 'Credited' : 'Debited';
    this.logger.log(`${action} ₹${Math.abs(amount)} ${amount > 0 ? 'to' : 'from'} customer ${customerId} wallet`);
  }

  /**
   * Compensate driver from cancellation charge
   */
  private async compensateDriver(
    driver: { id: string; walletBalance: any },
    booking: Booking,
    cancellationCharge: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    if (cancellationCharge <= 0) return 0;

    const driverWalletBefore = Number(driver.walletBalance);

    // Deduct platform commission from cancellation charge
    const commissionRate = this.configService.get<number>('COMMISSION_RATE') || 0.07;
    const compensation = truncate2(cancellationCharge * (1 - commissionRate));

    const newBalance = truncate2(driverWalletBefore + compensation);

    await tx.driver.update({
      where: { id: driver.id },
      data: { walletBalance: newBalance },
    });

    await tx.driverWalletLog.create({
      data: {
        driverId: driver.id,
        beforeBalance: driverWalletBefore,
        afterBalance: newBalance,
        amount: compensation,
        reason: `Cancellation compensation for Booking #${booking.bookingNumber}`,
        bookingId: booking.id,
      },
    });

    this.logger.log(`Compensated driver ${driver.id} with ₹${compensation} for cancellation`);
    return compensation;
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
