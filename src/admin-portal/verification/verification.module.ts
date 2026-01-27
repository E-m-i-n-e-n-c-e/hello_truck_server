/**
 * Verification Module
 *
 * Handles driver verification workflow:
 * - New driver verification (triggered on onboarding)
 * - Existing driver re-verification (document updates)
 * - Assignment to agents/field agents
 * - Status tracking
 *
 * Note: Actual document statuses remain in DriverDocuments model.
 * This module wraps the workflow with tickets, assignments, and audit trails.
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { VerificationQueueService, VERIFICATION_QUEUE_NAME } from './verification-queue.service';
import { VerificationQueueProcessor } from './verification-queue.processor';
import { VerificationAssignmentCron } from './verification-assignment.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    PrismaModule,
    AdminFirebaseModule,
    AuditLogModule,
    BullModule.registerQueueAsync({
      name: VERIFICATION_QUEUE_NAME,
      useFactory: (configService: ConfigService) => {
        const redisUrl = new URL(configService.get<string>('REDIS_URL')!);
        return {
          connection: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port || '6379'),
            password: redisUrl.password || undefined,
          },
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    VerificationQueueService,
    VerificationQueueProcessor,
    VerificationAssignmentCron,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}

