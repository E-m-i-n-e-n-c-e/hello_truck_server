import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { DriverAuthController } from './driver-auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGateway } from './auth.gateway';
import { OtpModule } from './otp/otp.module';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [
    PrismaModule,
    OtpModule,
    TokenModule,
  ],
  controllers: [CustomerAuthController, DriverAuthController],
  providers: [AuthService, AuthGateway],
})
export class AuthModule {}
