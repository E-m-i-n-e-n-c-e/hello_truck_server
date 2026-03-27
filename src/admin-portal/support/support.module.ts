import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { RedisModule } from '../redis/redis.module';
import { RedisService } from '../redis/redis.service';
import { AdminNotificationsModule } from '../notifications/admin-notifications.module';
import { SupportController } from './controllers/support.controller';
import { AdminSupportController } from './controllers/admin-support.controller';
import { SupportService } from './services/support.service';
import { AdminSupportService } from './services/admin-support.service';
import { RefundProcessorService } from './services/refund-processor.service';
import { SupportQueueService, SUPPORT_QUEUE_NAME } from './services/support-queue.service';
import { SupportQueueProcessor } from './support-queue.processor';
import { SupportCron } from './support.cron';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    AdminFirebaseModule,
    RazorpayModule,
    RedisModule,
    AdminNotificationsModule,
    BullModule.registerQueueAsync({
      name: SUPPORT_QUEUE_NAME,
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        connection: redisService.bullClient,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),
    }),
  ],
  controllers: [SupportController, AdminSupportController],
  providers: [
    SupportService,
    AdminSupportService,
    RefundProcessorService,
    SupportQueueService,
    SupportQueueProcessor,
    SupportCron,
  ],
  exports: [SupportService, AdminSupportService],
})
export class SupportModule {}
