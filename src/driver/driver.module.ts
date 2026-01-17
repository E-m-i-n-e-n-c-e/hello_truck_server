import { Module } from '@nestjs/common';
import { ProfileModule } from './profile/profile.module';
import { DocumentsModule } from './documents/documents.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { AddressModule } from './address/address.module';
import { PaymentModule } from './payment/payment.module';
import { TokenModule } from 'src/token/token.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { ReferralModule } from '../referral/referral.module';
import { DriverGateway } from './driver.gateway';
import { DriverReferralController } from './controllers/driver-referral.controller';

@Module({
  imports: [
    TokenModule,
    PrismaModule,
    ProfileModule,
    DocumentsModule,
    VehicleModule,
    AddressModule,
    PaymentModule,
    RedisModule,
    ReferralModule,
  ],
  controllers: [DriverReferralController],
  providers: [DriverGateway],
  exports: [DriverGateway],
})
export class DriverModule {}
