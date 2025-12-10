import { Controller, UseGuards, Get, Post, Put, Delete, Body } from '@nestjs/common';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { Roles } from 'src/token/decorators/roles.decorator';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { User } from 'src/token/decorators/user.decorator';
import { AddressService } from '../address/address.service';
import { AddressResponseDto, CreateDriverAddressDto, UpdateDriverAddressDto } from '../dtos/address.dto';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';

@Controller('driver/address')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('driver')
export class DriverAddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  @Serialize(AddressResponseDto)
  async getAddress(@User('userId') userId: string) {
    return this.addressService.getAddress(userId);
  }

  @Post()
  @Serialize(AddressResponseDto)
  async createAddress(
    @User('userId') userId: string,
    @Body() createAddressDto: CreateDriverAddressDto,
  ) {
    return this.addressService.createAddress(userId, createAddressDto);
  }

  @Put()
  @Serialize(AddressResponseDto)
  async updateAddress(
    @User('userId') userId: string,
    @Body() updateAddressDto: UpdateDriverAddressDto,
  ) {
    return this.addressService.updateAddress(userId, updateAddressDto);
  }

  @Delete()
  @Serialize(SuccessResponseDto)
  async deleteAddress(@User('userId') userId: string) {
    await this.addressService.deleteAddress(userId);
    return { success: true, message: 'Address deleted successfully' };
  }
}