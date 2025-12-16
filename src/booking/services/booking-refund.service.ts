import { Injectable, Logger } from '@nestjs/common';
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
      this.calculateRefundAmounts(booking.status, finalInvoice);

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
    const intent = await this.prisma.refundIntent.findUnique({
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

    if (!intent || intent.status !== 'PENDING') {
      this.logger.log(`Skipping refund intent ${intentId}: status=${intent?.status}`);
      return;
    }

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
      await this.prisma.$transaction(async (tx) => {
        // Handle PAID invoice: Credit wallet with refund
        if (Number(intent.walletRefundAmount) > 0 && intent.booking.customer) {
          await this.updateCustomerWallet(
            intent.customerId,
            intent.booking as Booking & { customer: Customer },
            Number(intent.walletRefundAmount),
            `Refund for cancelled Booking #${intent.booking.bookingNumber}`,
            tx,
          );
        }

        // Handle UNPAID invoice: Deduct cancellation charge from wallet
        if (!intent.wasPaid && Number(intent.cancellationCharge) > 0 && intent.booking.customer) {
          const chargeAmount = -Number(intent.cancellationCharge); // Negative for debit
          await this.updateCustomerWallet(
            intent.customerId,
            intent.booking as Booking & { customer: Customer },
            chargeAmount,
            `Cancellation charge for Booking #${intent.booking.bookingNumber}`,
            tx,
          );
        }

        // Process driver compensation if there's a cancellation charge and driver was assigned
        if (Number(intent.cancellationCharge) > 0 && intent.booking.assignedDriver) {
          await this.compensateDriver(
            intent.booking.assignedDriver,
            intent.booking,
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
              description: `Refund for cancelled booking #${intent.booking.bookingNumber}`,
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
        // Notify about refund for paid invoices
        const totalRefund = truncate2(Number(intent.walletRefundAmount) + Number(intent.razorpayRefundAmount));
        if (totalRefund > 0) {
          this.notificationService.notifyCustomerWalletCredited(
            intent.customerId,
            totalRefund,
          );
        }
      } else if (Number(intent.cancellationCharge) > 0) {
        // Notify about cancellation charge for unpaid invoices
        this.notificationService.notifyCustomerCancellationCharge(
          intent.customerId,
          Number(intent.cancellationCharge),
        );
      }

    } catch (error) {
      // Retry logic with exponential backoff
      const newRetryCount = intent.retryCount + 1;

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

      throw error;
    }
  }

  /**
   * Calculate refund amounts based on booking status
   */
  calculateRefundAmounts(
    status: BookingStatus,
    invoice: Invoice,
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
        walletRefund: walletApplied,
        razorpayRefund: finalAmount,
        cancellationCharge: 0,
      };
    }

    // Partial refund for CONFIRMED and PICKUP_ARRIVED
    if (status === BookingStatus.CONFIRMED || status === BookingStatus.PICKUP_ARRIVED) {
      const refundPercentage = 0.5; // 50% refund
      return {
        walletRefund: walletApplied * refundPercentage,
        razorpayRefund: finalAmount * refundPercentage,
        cancellationCharge: totalPaid * (1 - refundPercentage),
      };
    }

    // No refund for other statuses
    return {
      walletRefund: 0,
      razorpayRefund: 0,
      cancellationCharge: totalPaid,
    };
  }

  /**
   * Update customer wallet (credit or debit)
   * Positive amount = credit, Negative amount = debit
   */
  private async updateCustomerWallet(
    customerId: string,
    booking: Booking & { customer: Customer },
    amount: number,
    reason: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (amount <= 0) return;

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
      },
    });

    this.logger.log(`Credited ₹${amount} to customer ${customerId} wallet`);
  }

  /**
   * Compensate driver from cancellation charge
   */
  private async compensateDriver(
    driver: { id: string; walletBalance: any },
    booking: Booking,
    cancellationCharge: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (cancellationCharge <= 0) return;

    const driverWalletBefore = Number(driver.walletBalance);
    const compensation = truncate2(cancellationCharge);
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
