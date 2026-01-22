import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingRefundService } from '../../booking/services/booking-refund.service';

@Injectable()
export class RefundCronService {
  private readonly logger = new Logger(RefundCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingRefundService: BookingRefundService,
  ) {}

  /**
   * Process pending refund intents
   * Called by hourly cron job
   */
  async processPendingRefunds(): Promise<void> {
    this.logger.log('Processing pending refunds...');

    // Find PENDING refund intents ready for processing
    const intents = await this.prisma.refundIntent.findMany({
      where: {
        status: 'PENDING',
      },
    });

    if (intents.length === 0) {
      this.logger.log('No pending refunds to process');
      return;
    }

    this.logger.log(`Found ${intents.length} pending refunds`);

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
    }

    this.logger.log(`Refund processing complete: ${successCount} succeeded, ${failureCount} failed`);
  }

  /**
   * Clean up old refund intents (older than 1 month)
   * Called by daily cron job
   */
  async cleanupOldRefundIntents(): Promise<void> {
    this.logger.log('Cleaning up old refund intents...');

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const result = await this.prisma.refundIntent.deleteMany({
      where: {
        createdAt: {
          lt: oneMonthAgo,
        },
      },
    });

    this.logger.log(`Deleted ${result.count} old refund intents`);
  }
}
