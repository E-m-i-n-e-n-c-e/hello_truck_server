import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RazorpayService } from './razorpay.service';
import { RazorpayController } from './razorpay.controller';

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [RazorpayService],
  exports: [RazorpayService],
  controllers: [RazorpayController],
})
export class RazorpayModule {}