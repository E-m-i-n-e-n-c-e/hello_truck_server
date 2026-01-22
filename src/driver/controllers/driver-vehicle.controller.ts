import { Controller, UseGuards, Get, Post, Put, Delete, Body } from '@nestjs/common';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { Roles } from 'src/token/decorators/roles.decorator';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { User } from 'src/token/decorators/user.decorator';
import { VehicleService } from '../vehicle/vehicle.service';
import { VehicleResponseDto, CreateVehicleDto, UpdateVehicleDto } from '../dtos/vehicle.dto';
import { CreateVehicleOwnerDto, UpdateVehicleOwnerDto, VehicleOwnerResponseDto } from '../dtos/vehicle-owner.dto';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';
import { VehicleModelResponseDto } from '../dtos/vehicle-model.dto';

@Controller('driver/vehicle')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('driver')
export class DriverVehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get('models')
  @Serialize(VehicleModelResponseDto)
  async getAllVehicleModels() {
    return this.vehicleService.getAllVehicleModels();
  }

  @Get()
  @Serialize(VehicleResponseDto)
  async getVehicle(@User('userId') userId: string){
    return this.vehicleService.getVehicle(userId);
  }

  @Post()
  @Serialize(VehicleResponseDto)
  async createVehicle(
    @User('userId') userId: string,
    @Body() createVehicleDto: CreateVehicleDto,
  ) {
    return this.vehicleService.createVehicle(userId, createVehicleDto);
  }

  @Put()
  @Serialize(VehicleResponseDto)
  async updateVehicle(
    @User('userId') userId: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ) {
    return this.vehicleService.updateVehicle(userId, updateVehicleDto);
  }

  @Delete()
  @Serialize(SuccessResponseDto)
  async deleteVehicle(@User('userId') userId: string): Promise<SuccessResponseDto> {
    await this.vehicleService.deleteVehicle(userId);
    return { success: true, message: 'Vehicle deleted successfully' };
  }

  @Post('owner')
  @Serialize(VehicleOwnerResponseDto)
  async createVehicleOwner(
    @User('userId') userId: string,
    @Body() createOwnerDto: CreateVehicleOwnerDto,
  ): Promise<VehicleOwnerResponseDto> {
    const vehicle = await this.vehicleService.getVehicle(userId);
    return this.vehicleService.createVehicleOwner(vehicle.id, createOwnerDto);
  }

  @Put('owner')
  @Serialize(VehicleOwnerResponseDto)
  async updateVehicleOwner(
    @User('userId') userId: string,
    @Body() updateOwnerDto: UpdateVehicleOwnerDto,
  ): Promise<VehicleOwnerResponseDto> {
    const vehicle = await this.vehicleService.getVehicle(userId);
    return this.vehicleService.updateVehicleOwner(vehicle.id, updateOwnerDto);
  }
}