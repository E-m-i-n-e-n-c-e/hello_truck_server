import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/auth/firebase/firebase.module';
import { DocumentsModule } from '../documents/documents.module';
import { VehicleModule } from '../vehicle/vehicle.module';
import { TokenModule } from 'src/token/token.module';
import { DriverProfileController } from '../controllers/driver-profile.controller';
import { AddressModule } from '../address/address.module';
import { RazorpayModule } from 'src/razorpay/razorpay.module';

@Module({
  imports: [PrismaModule, FirebaseModule, DocumentsModule, VehicleModule, TokenModule, AddressModule, RazorpayModule],
  controllers: [DriverProfileController],
  providers: [ProfileService],
  exports: [ProfileService]
})
export class ProfileModule {}
