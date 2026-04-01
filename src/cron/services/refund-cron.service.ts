import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefundStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingRefundService } from '../../booking/services/booking-refund.service';
import { EnvironmentVariables } from '../../config/env.config';

@Injectable()
export class RefundCronService {
  private readonly logger = new Logger(RefundCronService.name);
  private readonly refundCronDelayMs: number;
  private readonly staleProcessingMinutes: number;
  private readonly refundRetryWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingRefundService: BookingRefundService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    this.refundCronDelayMs = this.configService.get<number>(
      'REFUND_CRON_DELAY_MS',
      100,
    );
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
   * Process pending refund intents
   * Called by hourly cron job
   */
  async processPendingRefunds(): Promise<void> {
    this.logger.log('Processing pending refunds...');

    const staleBefore = new Date(
      Date.now() - this.staleProcessingMinutes * 60 * 1000,
    );
    const twoDaysAgo = new Date(
      Date.now() - this.refundRetryWindowDays * 24 * 60 * 60 * 1000,
    );

    // Find retryable refund intents ready for processing.
    const intents = await this.prisma.refundIntent.findMany({
      where: {
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
        isApproved: true, // Only process approved refunds
      },
    });

    if (intents.length === 0) {
      this.logger.log('No retryable approved refunds to process');
      return;
    }

    this.logger.log(`Found ${intents.length} retryable approved refunds`);

    let successCount = 0;
    let failureCount = 0;

    for (const intent of intents) {
      try {
        await this.bookingRefundService.processRefundIntent(intent.id);
        successCount++;
      } catch (error) {
        this.logger.error(`Failed to process refund ${intent.id}: ${error.message}`);
        failureCount++;
        // Continue to next refund
      }

      await this.delay(this.refundCronDelayMs);
    }

    this.logger.log(`Refund processing complete: ${successCount} succeeded, ${failureCount} failed`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
