import { Module } from '@nestjs/common';
import { BookingCustomerController } from './controllers/booking-estimate.controller';
import { PricingModule } from './pricing/pricing.module';
import { TokenModule } from 'src/token/token.module';
import { FirebaseModule } from 'src/auth/firebase/firebase.module';
import { BookingCustomerService } from './services/booking-customer.service';
import { BookingEstimateService } from './services/booking-estimate.service';

@Module({
  imports: [PricingModule, TokenModule, FirebaseModule],
  controllers: [BookingCustomerController],
  providers: [BookingCustomerService, BookingEstimateService],
  exports: [BookingCustomerService],
})
export class BookingModule {}
