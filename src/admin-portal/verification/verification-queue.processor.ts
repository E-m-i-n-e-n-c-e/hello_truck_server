/**
 * Verification Queue Processor
 *
 * Processes delayed jobs when verification buffer expires:
 * - Finalize verifications → status becomes FINAL_APPROVED
 * - Updates driver status to VERIFIED
 * - Updates document statuses to VERIFIED
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VERIFICATION_QUEUE_NAME, VerificationJobData } from './services/verification-queue.service';
import { AdminVerificationService } from './services/admin-verification.service';

@Processor(VERIFICATION_QUEUE_NAME)
export class VerificationQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(VerificationQueueProcessor.name);

  constructor(
    private readonly adminVerificationService: AdminVerificationService,
  ) {
    super();
  }

  async process(job: Job<VerificationJobData>): Promise<void> {
    this.logger.log(`Processing verification finalization job for ${job.data.verificationId}`);

    try {
      await this.adminVerificationService.finalizeVerificationById(job.data.verificationId);
      this.logger.log(`Successfully finalized verification ${job.data.verificationId}`);
    } catch (error) {
      this.logger.error(`Failed to finalize verification ${job.data.verificationId}`, error);
      throw error; // Re-throw to trigger retry
    }
  }
}
