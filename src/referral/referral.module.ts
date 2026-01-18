import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { ReferralService } from './referral.service';

@Module({
  imports: [PrismaModule, FirebaseModule],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
