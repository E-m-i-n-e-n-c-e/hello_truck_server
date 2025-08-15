import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { User } from 'src/token/decorators/user.decorator';
import { CreateSavedAddressDto, UpdateSavedAddressDto, SavedAddressResponseDto } from '../dtos/address.dto';
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
  @Serialize(SavedAddressResponseDto)
  async createSavedAddress(
    @User('userId') userId: string,
    @Body() createSavedAddressDto: CreateSavedAddressDto,
  ): Promise<SavedAddressResponseDto> {
    return this.addressService.createSavedAddress(userId, createSavedAddressDto);
  }

  @Get()
  @Serialize(SavedAddressResponseDto)
  async getSavedAddresses(
    @User('userId') userId: string,
  ): Promise<SavedAddressResponseDto[]> {
    return this.addressService.getSavedAddresses(userId);
  }

  @Get(':id')
  @Serialize(SavedAddressResponseDto)
  async getSavedAddressById(
    @User('userId') userId: string,
    @Param('id') id: string,
  ): Promise<SavedAddressResponseDto> {
    return this.addressService.getSavedAddressById(userId, id);
  }

  @Put(':id')
  @Serialize(SavedAddressResponseDto)
  async updateSavedAddress(
    @User('userId') userId: string,
    @Param('id') id: string,
    @Body() updateSavedAddressDto: UpdateSavedAddressDto,
  ): Promise<SavedAddressResponseDto> {
    return this.addressService.updateSavedAddress(userId, id, updateSavedAddressDto);
  }

  @Delete(':id')
  @Serialize(SuccessResponseDto)
  async deleteSavedAddress(
    @User('userId') userId: string,
    @Param('id') id: string,
  ): Promise<SuccessResponseDto> {
    await this.addressService.deleteSavedAddress(userId, id);
    return { success: true, message: 'Address deleted successfully' };
  }

  @Post(':id/default')
  @Serialize(SavedAddressResponseDto)
  async setDefaultSavedAddress(
    @User('userId') userId: string,
    @Param('id') id: string,
  ): Promise<SavedAddressResponseDto> {
    return this.addressService.setDefaultSavedAddress(userId, id);
  }
}