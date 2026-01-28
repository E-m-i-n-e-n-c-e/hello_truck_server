/**
 * Admin Refund Module
 *
 * Handles manual refund creation, approval, and revert workflows.
 * Customer Support creates → Admin approves → Buffer window → Completion
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminRefundController } from './admin-refund.controller';
import { AdminRefundService } from './admin-refund.service';
import { RefundQueueService, REFUND_QUEUE_NAME } from './refund-queue.service';
import { RefundQueueProcessor } from './refund-queue.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    AdminFirebaseModule,
    RazorpayModule,
    RedisModule,
    BullModule.registerQueueAsync({
      name: REFUND_QUEUE_NAME,
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        return {
          connection: redisService.bullClient, // Use pre-configured Redis client with TLS
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false, // Keep failed jobs for debugging
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
  controllers: [AdminRefundController],
  providers: [AdminRefundService, RefundQueueService, RefundQueueProcessor],
  exports: [AdminRefundService],
})
export class AdminRefundModule {}
