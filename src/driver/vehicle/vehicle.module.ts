import { Module } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TokenModule } from 'src/token/token.module';
import { DriverVehicleController } from '../controllers/driver-vehicle.controller';

@Module({
  imports: [PrismaModule, TokenModule],
  controllers: [DriverVehicleController],
  providers: [VehicleService],
  exports: [VehicleService],
})
export class VehicleModule {}
