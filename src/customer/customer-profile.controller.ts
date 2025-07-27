import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { CreateProfileDto, GetProfileResponseDto, UpdateProfileDto } from './dtos/profile.dto';
import { AccessTokenGuard } from '../token/guards/access-token.guard';
import { User } from '../token/decorators/user.decorator';
import { Roles } from 'src/token/decorators/roles.decorator';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { seconds, Throttle } from '@nestjs/throttler';
import { ProfileService } from './profile/profile.service';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';

@Controller('customer/profile')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('customer')
@Throttle({ default: { ttl: seconds(60), limit: 40 } })
export class CustomerProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @Serialize(GetProfileResponseDto)
  async getProfile(
    @User('userId') userId: string,
  ): Promise<GetProfileResponseDto> {
    return this.profileService.getProfile(userId);
  }

  @Put()
  @Serialize(SuccessResponseDto)
  async updateProfile(
    @User('userId') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<SuccessResponseDto> {
    return this.profileService.updateProfile(userId, updateProfileDto);
  }

  @Post()
  @Serialize(SuccessResponseDto)
  async createProfile(
    @User('userId') userId: string,
    @Body() createProfileDto: CreateProfileDto,
  ): Promise<SuccessResponseDto> {
    return this.profileService.createProfile(userId, createProfileDto);
  }
}
