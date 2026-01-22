import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto} from '../dtos/vehicle.dto';
import { CreateVehicleOwnerDto, UpdateVehicleOwnerDto } from '../dtos/vehicle-owner.dto';
import { Prisma, VehicleType } from '@prisma/client';

@Injectable()
export class VehicleService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllVehicleModels() {
    return this.prisma.vehicleModel.findMany({
      orderBy: [
        { name: 'asc' }
      ]
    });
  }

  async createVehicle(driverId: string, createVehicleDto: CreateVehicleDto, tx: Prisma.TransactionClient = this.prisma) {
    const { owner, ...vehicleData } = createVehicleDto;

    // Validate vehicle model exists
    const vehicleModel = await tx.vehicleModel.findUnique({
      where: { name: vehicleData.vehicleModelName },
    });

    if (!vehicleModel) {
      throw new BadRequestException(`Invalid vehicle model: ${vehicleData.vehicleModelName}`);
    }

    // Check if vehicle already exists for this driver
    const existingVehicle = await tx.vehicle.findUnique({
      where: { driverId },
    });

    if (existingVehicle) {
      throw new BadRequestException('Vehicle already exists for this driver');
    }

    // Create vehicle
    const vehicle = await tx.vehicle.create({
      data: {
        ...vehicleData,
        driverId,
      },
      include: {
        owner: true,
        vehicleModel: true,
      },
    });

    // Create owner if provided
    if (owner) {
      await tx.vehicleOwner.create({
        data: {
          ...owner,
          vehicleId: vehicle.id,
        },
      });
    }

    return vehicle;
  }

  async updateVehicle(driverId: string, updateVehicleDto: UpdateVehicleDto) {
    if (updateVehicleDto.vehicleModelName) {
      const vehicleModel = await this.prisma.vehicleModel.findUnique({
        where: { name: updateVehicleDto.vehicleModelName },
      });

      if (!vehicleModel) {
        throw new BadRequestException(`Invalid vehicle model: ${updateVehicleDto.vehicleModelName}`);
      }
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return await this.prisma.vehicle.update({
      where: { driverId },
      data: updateVehicleDto,
      include: {
        owner: true,
        vehicleModel: true,
      },
    });
  }

  async getVehicle(driverId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
      include: {
        owner: true,
        vehicleModel: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async createVehicleOwner(vehicleId: string, createOwnerDto: CreateVehicleOwnerDto) {
    // Check if owner already exists for this vehicle
    const existingOwner = await this.prisma.vehicleOwner.findUnique({
      where: { vehicleId },
    });

    if (existingOwner) {
      throw new BadRequestException('Owner already exists for this vehicle');
    }

    return await this.prisma.vehicleOwner.create({
      data: {
        ...createOwnerDto,
        vehicleId,
      },
    });
  }

  async updateVehicleOwner(vehicleId: string, updateOwnerDto: UpdateVehicleOwnerDto) {
    const owner = await this.prisma.vehicleOwner.findUnique({
      where: { vehicleId },
    });

    if (!owner) {
      throw new NotFoundException('Vehicle owner not found');
    }

    return await this.prisma.vehicleOwner.update({
      where: { vehicleId },
      data: updateOwnerDto,
    });
  }

  async deleteVehicle(driverId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Delete owner first (if exists)
      await tx.vehicleOwner.deleteMany({
        where: { vehicleId: vehicle.id },
      });

      // Delete vehicle
      return await tx.vehicle.delete({
        where: { driverId },
      });
    });
  }
}