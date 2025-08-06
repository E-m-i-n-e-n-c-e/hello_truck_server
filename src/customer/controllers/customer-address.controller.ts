import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { User } from 'src/token/decorators/user.decorator';
import { CreateAddressDto, UpdateAddressDto, AddressResponseDto } from '../dtos/address.dto';
import { AddressService } from '../address/address.service';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { seconds } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';

@Controller('customer/addresses')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('customer')
@Throttle({ default: { ttl: seconds(60), limit: 40 } })
export class CustomerAddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @Serialize(AddressResponseDto)
  async createAddress(
    @User('userId') userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressService.createAddress(userId, createAddressDto);
  }

  @Get()
  @Serialize(AddressResponseDto)
  async getAddresses(
    @User('userId') userId: string,
  ): Promise<AddressResponseDto[]> {
    return this.addressService.getAddresses(userId);
  }

  @Get(':id')
  @Serialize(AddressResponseDto)
  async getAddressById(
    @User('userId') userId: string,
    @Param('id') id: string,
  ): Promise<AddressResponseDto> {
    return this.addressService.getAddressById(userId, id);
  }

  @Put(':id')
  @Serialize(AddressResponseDto)
  async updateAddress(
    @User('userId') userId: string,
    @Param('id') id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressService.updateAddress(userId, id, updateAddressDto);
  }

  @Delete(':id')
  @Serialize(SuccessResponseDto)
  async deleteAddress(
    @User('userId') userId: string,
    @Param('id') id: string,
  ): Promise<SuccessResponseDto> {
    await this.addressService.deleteAddress(userId, id);
    return { success: true, message: 'Address deleted successfully' };
  }

  @Post(':id/default')
  @Serialize(AddressResponseDto)
  async setDefaultAddress(
    @User('userId') userId: string,
    @Param('id') id: string,
  ): Promise<AddressResponseDto> {
    return this.addressService.setDefaultAddress(userId, id);
  }
}