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
import { AgentVerificationController } from './controllers/agent-verification.controller';
import { AdminVerificationService } from './services/admin-verification.service';
import { AgentVerificationService } from './services/agent-verification.service';
import { FieldVerificationService } from './services/field-verification.service';
import { VerificationQueueService, VERIFICATION_QUEUE_NAME } from './services/verification-queue.service';
import { VerificationQueueProcessor } from './verification-queue.processor';
import { VerificationCron } from './verification.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { AdminVerificationController } from './controllers/admin-verification.controller';
import { LibredeskModule } from '../libredesk/libredesk.module';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';

@Module({
  imports: [
    PrismaModule,
    AdminFirebaseModule,
    AuditLogModule,
    RedisModule,
    LibredeskModule,
    AdminNotificationsModule,
    BullModule.registerQueueAsync({
      name: VERIFICATION_QUEUE_NAME,
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        return {
          connection: redisService.bullClient, // Use pre-configured Redis client with TLS
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: true, // Clean up failed jobs to prevent memory leak
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
  controllers: [AdminVerificationController, AgentVerificationController],
  providers: [
    AdminVerificationService,
    AgentVerificationService,
    FieldVerificationService,
    VerificationQueueService,
    VerificationQueueProcessor,
    VerificationCron,
  ],
  exports: [AdminVerificationService, AgentVerificationService],
})
export class VerificationModule {}
