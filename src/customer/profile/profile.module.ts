import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GstModule } from '../gst/gst.module';
import { AddressModule } from '../address/address.module';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { TokenModule } from 'src/token/token.module';
import { CustomerProfileController } from '../controllers/customer-profile.controller';
import { ReferralModule } from 'src/referral/referral.module';

@Module({
  imports: [
    PrismaModule,
    GstModule,
    AddressModule,
    FirebaseModule,
    TokenModule,
    ReferralModule,
  ],
  controllers: [CustomerProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
