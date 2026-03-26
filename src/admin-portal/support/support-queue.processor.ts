import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SUPPORT_QUEUE_NAME, SupportJobData } from './services/support-queue.service';
import { AdminSupportService } from './services/admin-support.service';

@Processor(SUPPORT_QUEUE_NAME)
export class SupportQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SupportQueueProcessor.name);

  constructor(private readonly adminSupportService: AdminSupportService) {
    super();
  }

  async process(job: Job<SupportJobData>): Promise<void> {
    this.logger.log(`Processing refund finalization job for ${job.data.refundId}`);

    try {
      await this.adminSupportService.finalizeRefund(job.data.refundId);
    } catch (error) {
      this.logger.error(`Failed to finalize refund ${job.data.refundId}`, error);
      throw error;
    }
  }
}
