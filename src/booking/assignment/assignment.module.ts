import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { RedisModule } from 'src/redis/redis.module';
import { RazorpayModule } from 'src/razorpay/razorpay.module';
import { BullModule } from '@nestjs/bullmq';
import { AssignmentService } from './assignment.service';
import { AssignmentWorker } from './assignment.worker';
import { RedisService } from 'src/redis/redis.service';
import { BookingInvoiceService } from '../services/booking-invoice.service';
import { PricingService } from '../pricing/pricing.service';
import { BookingNotificationService } from '../services/booking-notification.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    FirebaseModule,
    RazorpayModule,
    BullModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        connection: redisService.bullClient,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      }),
    }),
    BullModule.registerQueue({ name: 'booking-assignment' }),
  ],
  providers: [
    AssignmentService,
    AssignmentWorker,
    BookingInvoiceService,
    PricingService,
    BookingNotificationService,
  ],
  exports: [AssignmentService],
})
export class AssignmentModule {}
