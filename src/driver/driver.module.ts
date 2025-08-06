import { Module } from '@nestjs/common';
import { ProfileModule } from './profile/profile.module';
import { DocumentsModule } from './documents/documents.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { TokenModule } from 'src/token/token.module';

@Module({
  imports: [TokenModule, ProfileModule, DocumentsModule, VehicleModule],
})
export class DriverModule {}
