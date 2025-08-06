import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TokenModule } from 'src/token/token.module';
import { CustomerAddressController } from '../controllers/customer-address.controller';

@Module({
  imports: [PrismaModule, TokenModule],
  controllers: [CustomerAddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}
