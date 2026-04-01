import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../../razorpay/razorpay.service';
import { AdminFirebaseService } from '../../firebase/admin-firebase.service';
import { FcmEventType } from '../../types/fcm.types';
import { AdminRefundStatus, PaymentMethod, Prisma, RefundStatus, TransactionCategory, TransactionType } from '@prisma/client';
import { toDecimal, toNumber, truncateDecimal } from '../utils/decimal.utils';
import { AdminEnvironmentVariables } from '../../config/admin-env.config';

const RATE_LIMIT_DELAY_MS = 1000;

/**
 * Admin portal refund processor
 * Handles refund processing independently from booking module
 * This service will be moved to a separate codebase during deployment
 */
@Injectable()
export class RefundProcessorService {
  private readonly logger = new Logger(RefundProcessorService.name);
  private readonly staleProcessingMinutes: number;
  private readonly refundRetryWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly firebaseService: AdminFirebaseService,
    private readonly configService: ConfigService<AdminEnvironmentVariables>,
  ) {
    this.staleProcessingMinutes = this.configService.get<number>(
      'REFUND_STALE_PROCESSING_MINUTES',
      15,
    );
    this.refundRetryWindowDays = this.configService.get<number>(
      'REFUND_RETRY_WINDOW_DAYS',
      2,
    );
  }

  /**
   * Process refund intent created by admin
   * Handles wallet credit AND Razorpay refund
   */
  async processRefundIntent(intentId: string): Promise<void> {
    const staleBefore = new Date(
      Date.now() - this.staleProcessingMinutes * 60 * 1000,
    );
    const twoDaysAgo = new Date(
      Date.now() - this.refundRetryWindowDays * 24 * 60 * 60 * 1000,
    );

    // Atomic claim: allow retries for FAILED or stale PROCESSING intents.
    const [intent] = await this.prisma.refundIntent.updateManyAndReturn({
      where: {
        id: intentId,
        OR: [
          { status: RefundStatus.PENDING },
          {
            status: RefundStatus.FAILED,
            createdAt: { gte: twoDaysAgo },
          },
          {
            status: RefundStatus.PROCESSING,
            processingStartedAt: { lte: staleBefore },
          },
        ],
      },
      data: {
        status: RefundStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
      include: {
        booking: {
          include: {
            customer: true,
            assignedDriver: true,
          },
        },
      },
    });

    if (!intent) {
      this.logger.log(`Refund intent ${intentId} already claimed`);
      return;
    }

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
            status: RefundStatus.COMPLETED,
            rzpRefundId,
            processedAt: new Date(),
          },
        });

        await tx.adminRefundRequest.updateMany({
          where: {
            refundIntentId: intentId,
            status: AdminRefundStatus.APPROVED,
          },
          data: {
            status: AdminRefundStatus.COMPLETED,
            completedAt: new Date(),
            bufferExpiresAt: null,
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
            status:
              newRetryCount >= intent.maxRetries
                ? RefundStatus.FAILED
                : RefundStatus.PENDING,
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
      const matchedRefund = await this.findExistingRefundWithRetry(
        rzpPaymentId,
        bookingId,
        amount,
      );

      if (matchedRefund) {
        this.logger.warn(`Refund already exists on Razorpay (ID: ${matchedRefund.refundId})`);
        return matchedRefund.refundId;
      }

      const refund = await this.createRefundWithRetry({
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

  private async findExistingRefundWithRetry(
    rzpPaymentId: string,
    bookingId: string,
    amount: number,
  ) {
    try {
      const existingRefunds = await this.razorpayService.fetchRefunds(rzpPaymentId);
      return existingRefunds.find(
        (refund) => refund.amount === amount && refund.notes?.bookingId === bookingId,
      );
    } catch (error) {
      if (!this.isRateLimitError(error)) {
        throw error;
      }

      this.logger.warn(
        `Rate limit while fetching refunds for payment ${rzpPaymentId}; retrying once after ${RATE_LIMIT_DELAY_MS}ms`,
      );
      await this.delay(RATE_LIMIT_DELAY_MS);
      const existingRefunds = await this.razorpayService.fetchRefunds(rzpPaymentId);
      return existingRefunds.find(
        (refund) => refund.amount === amount && refund.notes?.bookingId === bookingId,
      );
    }
  }

  private async createRefundWithRetry(params: {
    paymentId: string;
    amount: number;
    notes: Record<string, string>;
  }) {
    try {
      return await this.razorpayService.createRefund(params);
    } catch (error) {
      if (!this.isRateLimitError(error)) {
        throw error;
      }

      this.logger.warn(
        `Rate limit while creating refund for payment ${params.paymentId}; retrying once after ${RATE_LIMIT_DELAY_MS}ms`,
      );
      await this.delay(RATE_LIMIT_DELAY_MS);
      return this.razorpayService.createRefund(params);
    }
  }

  private isRateLimitError(error: any): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    const status = error?.response?.status ?? error?.status;
    return status === 429 || message.includes('429') || message.includes('rate limit');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
