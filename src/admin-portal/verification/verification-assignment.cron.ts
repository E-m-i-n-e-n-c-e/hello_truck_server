/**
 * Verification Assignment Cron Job
 *
 * Periodically assigns unassigned PENDING verifications to agents
 * Runs every 5 minutes to catch any verifications that failed auto-assignment
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationRequestStatus } from '@prisma/client';
import { VerificationService } from './verification.service';

@Injectable()
export class VerificationAssignmentCron {
  private readonly logger = new Logger(VerificationAssignmentCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
  ) {}

  /**
   * Assign unassigned verifications every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleUnassignedVerifications() {
    this.logger.log('Running verification assignment cron job...');

    try {
      // Find all PENDING verifications without assignment
      const unassignedVerifications = await this.prisma.driverVerificationRequest.findMany({
        where: {
          status: VerificationRequestStatus.PENDING,
          assignedToId: null,
        },
        select: {
          id: true,
          verificationType: true,
        },
        take: 50, // Process in batches
      });

      if (unassignedVerifications.length === 0) {
        return;
      }

      this.logger.log(`Found ${unassignedVerifications.length} unassigned verifications, attempting assignment...`);

      let assigned = 0;
      let failed = 0;

      // Process each verification
      for (const verification of unassignedVerifications) {
        const success = await this.verificationService.tryAssignVerification(
          verification.id,
          verification.verificationType,
        );
        if (success) {
          assigned++;
        } else {
          failed++;
        }
      }

      this.logger.log(`Assignment complete: ${assigned} assigned, ${failed} failed`);
    } catch (error) {
      this.logger.error('Verification assignment cron job failed', error);
    }
  }
}
