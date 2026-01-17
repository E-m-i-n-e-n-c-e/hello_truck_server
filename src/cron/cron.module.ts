import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RazorpayModule } from '../razorpay/razorpay.module';
import { RedisModule } from '../redis/redis.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { BookingModule } from '../booking/booking.module';
import { PaymentModule } from '../driver/payment/payment.module';
import { DocumentCleanupService } from './services/document-cleanup.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { DriverCleanupService } from './services/driver-cleanup.service';
import { BookingCleanupService } from './services/booking-cleanup.service';
import { LogCleanupService } from './services/log-cleanup.service';
import { PayoutService } from './services/payout.service';
import { RefundCronService } from './services/refund-cron.service';
import { RedisService } from '../redis/redis.service';
import { BookingRefundService } from 'src/booking/services/booking-refund.service';

@Module({
  imports: [
    PrismaModule,
    RazorpayModule,
    RedisModule,
    FirebaseModule,
    BookingModule,
    PaymentModule,
  ],
  providers: [
    CronService,
    DocumentCleanupService,
    SessionCleanupService,
    DriverCleanupService,
    BookingCleanupService,
    LogCleanupService,
    RedisService,
    PayoutService,
    RefundCronService,
    BookingRefundService,
  ],
})
export class CronModule {}
