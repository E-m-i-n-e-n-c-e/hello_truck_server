/**
 * Verification Queue Processor
 *
 * Processes delayed jobs when verification buffer expires:
 * - Finalize verifications → status becomes FINAL_APPROVED
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VERIFICATION_QUEUE_NAME, VerificationJobData } from './verification-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationRequestStatus } from '@prisma/client';

@Processor(VERIFICATION_QUEUE_NAME)
export class VerificationQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(VerificationQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<VerificationJobData>): Promise<void> {
    this.logger.log(`Processing verification finalization job for ${job.data.verificationId}`);

    try {
      await this.finalizeVerification(job.data.verificationId);
    } catch (error) {
      this.logger.error(`Failed to finalize verification ${job.data.verificationId}`, error);
      throw error; // Re-throw to trigger retry
    }
  }

  private async finalizeVerification(verificationId: string): Promise<void> {
    // Only finalize if still in APPROVED status (not reverted)
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      this.logger.warn(`Verification ${verificationId} not found`);
      return;
    }

    if (verification.status !== VerificationRequestStatus.APPROVED) {
      this.logger.log(`Verification ${verificationId} is no longer APPROVED (${verification.status}), skipping`);
      return;
    }

    await this.prisma.driverVerificationRequest.update({
      where: { id: verificationId },
      data: { status: VerificationRequestStatus.FINAL_APPROVED },
    });

    this.logger.log(`Finalized verification ${verificationId}`);
  }
}
