import { Module } from '@nestjs/common';
import { GstModule } from './gst/gst.module';
import { ProfileModule } from './profile/profile.module';
import { TokenModule } from 'src/token/token.module';
import { AddressModule } from './address/address.module';
import { ReferralModule } from '../referral/referral.module';
import { CustomerReferralController } from './controllers/customer-referral.controller';

@Module({
  imports: [
    GstModule,
    ProfileModule,
    TokenModule,
    AddressModule,
    ReferralModule,
  ],
  controllers: [CustomerReferralController],
})
export class CustomerModule {}
