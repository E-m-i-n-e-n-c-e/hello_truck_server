import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { DriverAuthController } from './driver-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OtpModule } from './otp/otp.module';
import { TokenModule } from '../token/token.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [PrismaModule, OtpModule, TokenModule, ReferralModule],
  controllers: [CustomerAuthController, DriverAuthController],
  providers: [AuthService],
})
export class AuthModule {}
