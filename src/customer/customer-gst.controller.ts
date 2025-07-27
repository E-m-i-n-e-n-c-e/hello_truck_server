import { Controller, Get, Post, Body, UseGuards, Param, Put } from '@nestjs/common';
import { User } from 'src/token/decorators/user.decorator';
import { CreateGstDetailsDto, DeactivateGstDetailsDto, GstDetailsResponseDto, ReactivateGstDetailsDto, UpdateGstDetailsDto } from './dtos/gst-details.dto';
import { GstService } from './gst/gst.service';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { seconds } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';

@Controller('customer/gst')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('customer')
@Throttle({ default: { ttl: seconds(60), limit: 40 } })
export class CustomerGstController {
  constructor(private readonly gstService: GstService) {}

  @Post()
  @Serialize(SuccessResponseDto)
  async addGstDetails(
    @User('userId') userId: string,
    @Body() createGstDetailsDto: CreateGstDetailsDto,
  ): Promise<SuccessResponseDto> {
    return this.gstService.addGstDetails(userId, createGstDetailsDto);
  }

  @Get()
  @Serialize(GstDetailsResponseDto)
  async getGstDetails(@User('userId') userId: string): Promise<GstDetailsResponseDto[]> {
    return this.gstService.getGstDetails(userId);
  }

  @Get(':id')
  @Serialize(GstDetailsResponseDto)
  async getGstDetailsById(
    @User('userId') userId: string,
    @Param('id') id: string,
  ): Promise<GstDetailsResponseDto> {
    return this.gstService.getGstDetailsById(userId, id);
  }

  @Put(':id')
  @Serialize(SuccessResponseDto)
  async updateGstDetails(
    @User('userId') userId: string,
    @Param('id') id: string,
    @Body() updateGstDetailsDto: UpdateGstDetailsDto,
  ): Promise<SuccessResponseDto> {
    return this.gstService.updateGstDetails(userId, id, updateGstDetailsDto);
  }

  @Post('deactivate')
  @Serialize(SuccessResponseDto)
  async deactivateGstDetails(
    @User('userId') userId: string,
    @Body() deactivateGstDetailsDto: DeactivateGstDetailsDto,
  ): Promise<SuccessResponseDto> {
    return this.gstService.deactivateGstDetails(userId, deactivateGstDetailsDto.id);
  }

  @Post('reactivate')
  @Serialize(SuccessResponseDto)
  async reactivateGstDetails(
    @User('userId') userId: string,
    @Body() reactivateGstDetailsDto: ReactivateGstDetailsDto,
  ): Promise<SuccessResponseDto> {
    return this.gstService.reactivateGstDetails(userId, reactivateGstDetailsDto.gstNumber);
  }
}