/**
 * Refund Queue Processor
 *
 * Processes delayed jobs when refund buffer expires:
 * - Finalize refunds → refund is executed via AdminRefundService
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REFUND_QUEUE_NAME, RefundJobData } from './refund-queue.service';
import { AdminRefundService } from './admin-refund.service';

@Processor(REFUND_QUEUE_NAME)
export class RefundQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(RefundQueueProcessor.name);

  constructor(
    private readonly refundService: AdminRefundService,
  ) {
    super();
  }

  async process(job: Job<RefundJobData>): Promise<void> {
    this.logger.log(`Processing refund finalization job for ${job.data.refundId}`);

    try {
      await this.refundService.finalizeRefund(job.data.refundId);
    } catch (error) {
      this.logger.error(`Failed to finalize refund ${job.data.refundId}`, error);
      throw error; // Re-throw to trigger retry
    }
  }
}
