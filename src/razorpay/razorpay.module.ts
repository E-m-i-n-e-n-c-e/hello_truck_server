import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RazorpayService } from './razorpay.service';
import { RazorpayXService } from './razorpayx.service';
import { RazorpayController } from './razorpay.controller';

@Module({
  imports: [ConfigModule],
  providers: [RazorpayService, RazorpayXService],
  exports: [RazorpayService, RazorpayXService],
  controllers: [RazorpayController],
})
export class RazorpayModule {}