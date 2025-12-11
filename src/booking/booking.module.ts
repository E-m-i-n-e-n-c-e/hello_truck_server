import { Module } from '@nestjs/common';
import { BookingCustomerController } from './controllers/booking-customer.controller';
import { BookingDriverController } from './controllers/booking-driver.controller';
import { PricingModule } from './pricing/pricing.module';
import { TokenModule } from 'src/token/token.module';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { BookingCustomerService } from './services/booking-customer.service';
import { BookingDriverService } from './services/booking-driver.service';
import { BookingInvoiceService } from './services/booking-invoice.service';
import { RedisModule } from 'src/redis/redis.module';
import { AssignmentModule } from './assignment/assignment.module';

@Module({
  imports: [PricingModule, TokenModule, FirebaseModule, RedisModule, AssignmentModule],
  controllers: [BookingCustomerController, BookingDriverController],
  providers: [BookingCustomerService, BookingDriverService, BookingInvoiceService],
  exports: [BookingCustomerService, BookingDriverService, BookingInvoiceService],
})
export class BookingModule {}
