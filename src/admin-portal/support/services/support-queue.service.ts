import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';

export const SUPPORT_QUEUE_NAME = 'admin-support-buffer';

export interface SupportJobData {
  refundId: string;
}

@Injectable()
export class SupportQueueService {
  private readonly logger = new Logger(SupportQueueService.name);

  constructor(
    @InjectQueue(SUPPORT_QUEUE_NAME) private readonly supportQueue: Queue<SupportJobData>,
  ) {}

  async scheduleRefundFinalization(refundId: string, bufferExpiresAt: Date): Promise<Job<SupportJobData>> {
    const delay = bufferExpiresAt.getTime() - Date.now();

    const job = await this.supportQueue.add(
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

  async cancelRefundFinalization(refundId: string): Promise<boolean> {
    const job = await this.supportQueue.getJob(`refund-${refundId}`);

    if (job) {
      await job.remove();
      this.logger.log(`Cancelled refund finalization for ${refundId}`);
      return true;
    }

    return false;
  }
}
