import { Module } from '@nestjs/common';
import { BookingCustomerController } from './controllers/booking-customer.controller';
import { BookingDriverController } from './controllers/booking-driver.controller';
import { BookingPaymentController } from './controllers/booking-payment.controller';
import { PricingModule } from './pricing/pricing.module';
import { TokenModule } from 'src/token/token.module';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { BookingCustomerService } from './services/booking-customer.service';
import { BookingDriverService } from './services/booking-driver.service';
import { BookingInvoiceService } from './services/booking-invoice.service';
import { BookingPaymentService } from './services/booking-payment.service';
import { BookingNotificationService } from './services/booking-notification.service';
import { RedisModule } from 'src/redis/redis.module';
import { AssignmentModule } from './assignment/assignment.module';
import { RazorpayModule } from 'src/razorpay/razorpay.module';

@Module({
  imports: [PricingModule, TokenModule, FirebaseModule, RedisModule, AssignmentModule, RazorpayModule],
  controllers: [BookingCustomerController, BookingDriverController, BookingPaymentController],
  providers: [BookingCustomerService, BookingDriverService, BookingInvoiceService, BookingPaymentService, BookingNotificationService],
  exports: [BookingCustomerService, BookingDriverService],
})
export class BookingModule {}
