import { Module } from '@nestjs/common';
import { DriverProfileController } from './driver-profile.controller';
import { ProfileModule } from './profile/profile.module';
import { TokenModule } from 'src/token/token.module';

@Module({
  imports: [TokenModule, ProfileModule],
  controllers: [DriverProfileController],
})
export class DriverModule {}
