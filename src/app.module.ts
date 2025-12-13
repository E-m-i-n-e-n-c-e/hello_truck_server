import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CronModule } from './cron/cron.module';
import { APP_GUARD } from '@nestjs/core';
import { CustomerModule } from './customer/customer.module';
import { TokenModule } from './token/token.module';
import { CustomThrottlerGuard } from './token/guards/custom-throttler.guard';
import { DriverModule } from './driver/driver.module';
import { BookingModule } from './booking/booking.module';
import { AdminModule } from './admin/admin.module';
import { validate } from './config/env.config';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      validate, // Fail-fast validation on startup
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: seconds(60), // 1 minute
      limit: 200, // 200 requests per ttl
    }]),
    AuthModule,
    CronModule,
    TokenModule,
    CustomerModule,
    DriverModule,
    BookingModule,
    AdminModule,
  ],
  providers: [ {
    provide: APP_GUARD,
    useClass: CustomThrottlerGuard,
  }],
})
export class AppModule {}
