import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RazorpayModule } from 'src/razorpay/razorpay.module';
import { PaymentModule } from 'src/driver/payment/payment.module';
import { BookingModule } from 'src/booking/booking.module';

@Module({
  imports: [
    PrismaModule,
    RazorpayModule,
    PaymentModule, // For DriverPaymentService
    BookingModule, // For BookingPaymentService
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
