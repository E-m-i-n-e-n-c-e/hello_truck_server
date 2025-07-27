import { Module } from '@nestjs/common';
import { GstModule } from './gst/gst.module';
import { ProfileModule } from './profile/profile.module';
import { CustomerProfileController } from './customer-profile.controller';
import { CustomerGstController } from './customer-gst.controller';
import { TokenModule } from 'src/token/token.module';
import { AddressModule } from './address/address.module';
import { CustomerAddressController } from './customer-address.controller';

@Module({
  imports: [GstModule, ProfileModule, TokenModule, AddressModule],
  controllers: [CustomerProfileController, CustomerGstController, CustomerAddressController],
})
export class CustomerModule {}
