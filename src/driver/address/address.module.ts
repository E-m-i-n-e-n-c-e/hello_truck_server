import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TokenModule } from 'src/token/token.module';
import { DriverAddressController } from '../controllers/driver-address.controller';

@Module({
  imports: [PrismaModule, TokenModule],
  controllers: [DriverAddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}