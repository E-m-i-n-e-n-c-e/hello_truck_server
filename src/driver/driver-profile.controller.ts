import { Controller, UseGuards, Post, Get, Put, Body, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { Roles } from 'src/token/decorators/roles.decorator';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { ProfileService } from './profile/profile.service';
import { User } from 'src/token/decorators/user.decorator';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';
import { ProfileResponseDto, UpdateProfileDto, CreateDriverProfileDto, GetProfileDto } from './dtos/profile.dto';

@Controller('driver')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('driver')
export class DriverProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  @Serialize(ProfileResponseDto)
  async getProfile(@User('userId') userId: string, @Query() getProfileDto: GetProfileDto) {
    return this.profileService.getProfile(userId, getProfileDto);
  }

  @Post('profile')
  @Serialize(SuccessResponseDto)
  async createProfile(
    @User('userId') userId: string,
    @Body() createProfileDto: CreateDriverProfileDto,
  ) {
    return this.profileService.createProfile(userId, createProfileDto);
  }

  @Put('profile')
  @Serialize(SuccessResponseDto)
  async updateProfile(
    @User('userId') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, updateProfileDto);
  }
}

