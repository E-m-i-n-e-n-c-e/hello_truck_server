/**
 * Verification Finalization Cron Job
 *
 * Fallback mechanism for when Bull queue fails to process verification finalization.
 * Periodically checks for APPROVED verifications where buffer has expired and finalizes them.
 * Runs every 5 minutes to ensure no verification gets stuck in APPROVED state.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationRequestStatus } from '@prisma/client';
import { VerificationService } from './verification.service';

@Injectable()
export class VerificationCron {
  private readonly logger = new Logger(VerificationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
  ) {}

  /**
   * Finalize expired buffer verifications every 2 hours
   * This is a fallback in case the Bull queue fails
   */
  @Cron(CronExpression.EVERY_2_HOURS)
  async handleExpiredBufferVerifications() {
    this.logger.log('Running verification finalization cron job...');

    try {
      const now = new Date();

      // Find all APPROVED verifications where buffer has expired
      const expiredVerifications = await this.prisma.driverVerificationRequest.findMany({
        where: {
          status: VerificationRequestStatus.APPROVED,
          bufferExpiresAt: {
            lte: now, // Buffer expiry time is less than or equal to now
          },
        },
        select: {
          id: true,
          driverId: true,
        },
        take: 50, // Process in batches to avoid overwhelming the system
      });

      if (expiredVerifications.length === 0) {
        this.logger.debug('No expired buffer verifications found');
        return;
      }

      this.logger.log(
        `Found ${expiredVerifications.length} expired buffer verifications, finalizing...`,
      );

      let finalized = 0;
      let failed = 0;

      // Process each verification using the service method
      for (const verification of expiredVerifications) {
        try {
          await this.verificationService.finalizeVerificationById(verification.id);
          this.logger.log(
            `Successfully finalized verification ${verification.id} - driver ${verification.driverId} is now VERIFIED`,
          );

          finalized++;
        } catch (error) {
          this.logger.error(
            `Failed to finalize verification ${verification.id}`,
            error,
          );
          failed++;
        }
      }

      this.logger.log(
        `Finalization complete: ${finalized} finalized, ${failed} failed`,
      );
    } catch (error) {
      this.logger.error('Verification finalization cron job failed', error);
    }
  }
}
