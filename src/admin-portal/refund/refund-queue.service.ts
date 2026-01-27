/**
 * Refund Queue Service
 *
 * Schedules delayed jobs for refund buffer expiry:
 * - When a refund is approved, schedule finalization for bufferExpiresAt
 * - When a revert is requested, cancel the pending finalization
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

export const REFUND_QUEUE_NAME = 'admin-refund-buffer';

export interface RefundJobData {
  refundId: string;
}

@Injectable()
export class RefundQueueService {
  private readonly logger = new Logger(RefundQueueService.name);

  constructor(
    @InjectQueue(REFUND_QUEUE_NAME) private readonly refundQueue: Queue<RefundJobData>,
  ) {}

  /**
   * Schedule refund finalization after buffer expires
   */
  async scheduleRefundFinalization(refundId: string, bufferExpiresAt: Date): Promise<Job<RefundJobData>> {
    const delay = bufferExpiresAt.getTime() - Date.now();

    const job = await this.refundQueue.add(
      'finalize-refund',
      { refundId },
      {
        delay: Math.max(0, delay),
        jobId: `refund-${refundId}`,
      },
    );

    this.logger.log(`Scheduled refund finalization for ${refundId} in ${Math.round(delay / 60000)} minutes`);
    return job;
  }

  /**
   * Cancel pending refund finalization
   */
  async cancelRefundFinalization(refundId: string): Promise<boolean> {
    const jobId = `refund-${refundId}`;
    const job = await this.refundQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`Cancelled refund finalization for ${refundId}`);
      return true;
    }

    return false;
  }
}
