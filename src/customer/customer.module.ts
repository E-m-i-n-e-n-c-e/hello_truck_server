import { Module } from '@nestjs/common';
import { GstModule } from './gst/gst.module';
import { ProfileModule } from './profile/profile.module';
import { TokenModule } from 'src/token/token.module';
import { AddressModule } from './address/address.module';

@Module({
  imports: [GstModule, ProfileModule, TokenModule, AddressModule],
})
export class CustomerModule {}
