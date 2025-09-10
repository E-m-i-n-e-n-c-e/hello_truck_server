import { Module } from '@nestjs/common';
import { BookingCustomerController } from './controllers/booking-customer.controller';
import { PricingModule } from './pricing/pricing.module';
import { TokenModule } from 'src/token/token.module';
import { FirebaseModule } from 'src/auth/firebase/firebase.module';
import { BookingCustomerService } from './services/booking-customer.service';
import { BookingEstimateService } from './services/booking-estimate.service';
import { BookingAssignmentService } from './services/booking-assignment.service';
import { RedisModule } from 'src/redis/redis.module';
import { AssignmentModule } from './assignment/assignment.module';

@Module({
  imports: [PricingModule, TokenModule, FirebaseModule, RedisModule, AssignmentModule],
  controllers: [BookingCustomerController],
  providers: [BookingCustomerService, BookingEstimateService, BookingAssignmentService],
  exports: [BookingCustomerService, BookingAssignmentService],
})
export class BookingModule {}
