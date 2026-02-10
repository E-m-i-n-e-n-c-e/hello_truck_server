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
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { VerificationQueueService, VERIFICATION_QUEUE_NAME } from './verification-queue.service';
import { VerificationQueueProcessor } from './verification-queue.processor';
import { VerificationCron } from './verification.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [
    PrismaModule,
    AdminFirebaseModule,
    AuditLogModule,
    RedisModule,
    BullModule.registerQueueAsync({
      name: VERIFICATION_QUEUE_NAME,
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        return {
          connection: redisService.bullClient, // Use pre-configured Redis client with TLS
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
    }),
  ],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    VerificationQueueService,
    VerificationQueueProcessor,
    VerificationCron,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}

