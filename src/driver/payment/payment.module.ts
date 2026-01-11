import { Module } from '@nestjs/common';
import { DriverPaymentController } from '../controllers/driver-payment.controller';
import { DriverPaymentService } from './payment.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { RazorpayModule } from 'src/razorpay/razorpay.module';
import { TokenModule } from 'src/token/token.module';

@Module({
  imports: [PrismaModule, RedisModule, RazorpayModule, TokenModule],
  controllers: [DriverPaymentController],
  providers: [DriverPaymentService],
  exports: [DriverPaymentService],
})
export class PaymentModule {}
