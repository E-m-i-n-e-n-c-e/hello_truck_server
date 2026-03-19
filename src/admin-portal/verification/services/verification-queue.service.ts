/**
 * Verification Queue Service
 *
 * Schedules delayed jobs for verification buffer expiry:
 * - When a verification is approved, schedule finalization for bufferExpiresAt
 * - When a revert is requested, cancel the pending finalization
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';

export const VERIFICATION_QUEUE_NAME = 'admin-verification-buffer';

export interface VerificationJobData {
  verificationId: string;
}

@Injectable()
export class VerificationQueueService {
  private readonly logger = new Logger(VerificationQueueService.name);

  constructor(
    @InjectQueue(VERIFICATION_QUEUE_NAME) private readonly verificationQueue: Queue<VerificationJobData>,
  ) {}

  /**
   * Schedule verification finalization after buffer expires
   * @param verificationId Verification request ID
   * @param bufferExpiresAt When buffer expires
   */
  async scheduleVerificationFinalization(verificationId: string, bufferExpiresAt: Date): Promise<Job<VerificationJobData>> {
    const delay = bufferExpiresAt.getTime() - Date.now();

    if (delay <= 0) {
      this.logger.warn(`Buffer already expired for verification ${verificationId}, finalizing immediately`);
    }

    const job = await this.verificationQueue.add(
      'finalize-verification',
      { verificationId },
      {
        delay: Math.max(0, delay), // If already expired, run immediately
        jobId: `verification-${verificationId}`, // Unique ID to prevent duplicates
      },
    );

    this.logger.log(`Scheduled verification finalization for ${verificationId} in ${Math.round(delay / 60000)} minutes`);
    return job;
  }

  /**
   * Cancel pending verification finalization (e.g., when revert is requested)
   * @param verificationId Verification request ID
   */
  async cancelVerificationFinalization(verificationId: string): Promise<boolean> {
    const jobId = `verification-${verificationId}`;
    const job = await this.verificationQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`Cancelled verification finalization for ${verificationId}`);
      return true;
    }

    return false;
  }
}
