import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { AdminFirebaseService } from '../../firebase/admin-firebase.service';
import { FcmEventType } from '../../types/fcm.types';
import { PaymentMethod, Prisma, TransactionCategory, TransactionType } from '@prisma/client';
import { toDecimal, toNumber, truncateDecimal } from '../utils/decimal.utils';

/**
 * Admin portal refund processor
 * Handles refund processing independently from booking module
 * This service will be moved to a separate codebase during deployment
 */
@Injectable()
export class RefundProcessorService {
  private readonly logger = new Logger(RefundProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly firebaseService: AdminFirebaseService,
  ) {}

  /**
   * Process refund intent created by admin
   * Handles wallet credit AND Razorpay refund
   */
  async processRefundIntent(intentId: string): Promise<void> {
    // Atomic claim: Mark as PROCESSING only if still PENDING
    const claimed = await this.prisma.refundIntent.updateMany({
      where: {
        id: intentId,
        status: 'PENDING',
      },
      data: { status: 'PROCESSING' },
    });

    if (claimed.count === 0) {
      this.logger.log(`Refund intent ${intentId} already claimed`);
      return;
    }

    const intent = await this.prisma.refundIntent.findUniqueOrThrow({
      where: { id: intentId },
      include: {
        booking: {
          include: {
            customer: true,
            assignedDriver: true,
          },
        },
      },
    });

    try {
      // Execute Razorpay refund first
      let rzpRefundId: string | null = null;
      if (Number(intent.razorpayRefundAmount) > 0 && intent.rzpPaymentId) {
        rzpRefundId = await this.executeRazorpayRefund(
          intent.booking.id,
          intent.rzpPaymentId,
          Number(intent.razorpayRefundAmount),
        );
      }

      // Update database
      await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: intent.bookingId },
          include: { customer: true },
        });

        // Credit wallet refund
        if (Number(intent.walletRefundAmount) !== 0 && booking.customer) {
          await this.updateCustomerWallet(
            intent.customerId,
            booking.customer.walletBalance,
            Number(intent.walletRefundAmount),
            `Refund for cancelled Booking #${booking.bookingNumber}`,
            booking.id,
            intentId,
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
              type: TransactionType.CREDIT,
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

      // Send notification to customer
      if (intent.wasPaid) {
        if (Number(intent.walletRefundAmount) > 0 || Number(intent.razorpayRefundAmount) > 0) {
          this.firebaseService
            .notifyAllSessions(
              intent.customerId,
              'customer',
              {
                notification: {
                  title: 'Refund Processed',
                  body: `Refund processed for Booking #${intent.booking.bookingNumber}`,
                },
                data: {
                  event: FcmEventType.RefundProcessed,
                },
              },
              this.prisma,
            )
            .catch((error) => {
              this.logger.error(`Failed to notify customer ${intent.customerId}`, error);
            });
        }
      }
    } catch (error) {
      this.logger.error(`✗ Refund FAILED: ${intentId} ${error.message}`);
      const newRetryCount = intent.retryCount + 1;

      try {
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
        this.logger.error(`Failed to update refund intent ${intentId}: ${updateError.message}`);
      }
    }
  }

  /**
   * Update customer wallet (credit or debit)
   */
  private async updateCustomerWallet(
    customerId: string,
    currentBalance: any,
    amount: number,
    reason: string,
    bookingId: string,
    refundIntentId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (amount === 0) return;

    const walletBefore = toDecimal(currentBalance);
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
        bookingId,
        refundIntentId,
      },
    });

    const action = amount > 0 ? 'Credited' : 'Debited';
    this.logger.log(`${action} ₹${Math.abs(amount)} ${amount > 0 ? 'to' : 'from'} customer ${customerId} wallet`);
  }

  /**
   * Execute Razorpay refund with idempotency check
   */
  private async executeRazorpayRefund(
    bookingId: string,
    rzpPaymentId: string,
    amount: number,
  ): Promise<string | null> {
    if (amount <= 0 || !rzpPaymentId) return null;

    try {
      // Check if refund already exists (idempotency)
      const existingRefunds = await this.razorpayService.fetchRefunds(rzpPaymentId);
      const matchedRefund = existingRefunds.find(
        (r) => r.amount === amount && r.notes?.bookingId === bookingId,
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
          bookingId,
          reason: 'Booking cancelled',
        },
      });

      this.logger.log(`Razorpay refund created: ₹${amount} for booking ${bookingId}`);
      return refund.refundId;
    } catch (error) {
      this.logger.error(`Razorpay refund failed: ${error.message}`);
      throw error;
    }
  }
}
