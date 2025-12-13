import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RazorpayService } from './razorpay.service';
import { RazorpayXService } from './razorpayx.service';

@Module({
  imports: [ConfigModule],
  providers: [RazorpayService, RazorpayXService],
  exports: [RazorpayService, RazorpayXService],
})
export class RazorpayModule {}