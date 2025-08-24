import { Module } from '@nestjs/common';
import { ProfileModule } from './profile/profile.module';
import { DocumentsModule } from './documents/documents.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { AddressModule } from './address/address.module';
import { TokenModule } from 'src/token/token.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DriverGateway } from './driver.gateway';

@Module({
  imports: [TokenModule, PrismaModule, ProfileModule, DocumentsModule, VehicleModule, AddressModule],
  providers: [DriverGateway],
  exports: [DriverGateway],
})
export class DriverModule {}
