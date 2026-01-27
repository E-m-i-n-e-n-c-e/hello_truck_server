/**
 * Admin Refund Module
 *
 * Handles manual refund creation, approval, and revert workflows.
 * Customer Support creates → Admin approves → Buffer window → Completion
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AdminRefundController } from './admin-refund.controller';
import { AdminRefundService } from './admin-refund.service';
import { RefundQueueService, REFUND_QUEUE_NAME } from './refund-queue.service';
import { RefundQueueProcessor } from './refund-queue.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';
import { RazorpayModule } from '../razorpay/razorpay.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    AdminFirebaseModule,
    RazorpayModule,
    BullModule.registerQueueAsync({
      name: REFUND_QUEUE_NAME,
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
            removeOnFail: false, // Keep failed jobs for debugging
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
  controllers: [AdminRefundController],
  providers: [AdminRefundService, RefundQueueService, RefundQueueProcessor],
  exports: [AdminRefundService],
})
export class AdminRefundModule {}
