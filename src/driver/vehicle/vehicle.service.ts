import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto, CreateVehicleOwnerDto, UpdateVehicleOwnerDto } from '../dtos/vehicle.dto';

@Injectable()
export class VehicleService {
  constructor(private readonly prisma: PrismaService) {}

  async createVehicle(driverId: string, createVehicleDto: CreateVehicleDto) {
    const { owner, ...vehicleData } = createVehicleDto;

    // Check if vehicle already exists for this driver
    const existingVehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (existingVehicle) {
      throw new BadRequestException('Vehicle already exists for this driver');
    }

    // Check if vehicle number is already taken
    const existingVehicleNumber = await this.prisma.vehicle.findUnique({
      where: { vehicleNumber: vehicleData.vehicleNumber },
    });

    if (existingVehicleNumber) {
      throw new BadRequestException('Vehicle number already exists');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Create vehicle
      const vehicle = await tx.vehicle.create({
        data: {
          ...vehicleData,
          driverId,
        },
        include: {
          owner: true,
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
    });
  }

  async updateVehicle(driverId: string, updateVehicleDto: UpdateVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    // Check if vehicle number is being changed and if it's already taken
    if (updateVehicleDto.vehicleNumber && updateVehicleDto.vehicleNumber !== vehicle.vehicleNumber) {
      const existingVehicleNumber = await this.prisma.vehicle.findUnique({
        where: { vehicleNumber: updateVehicleDto.vehicleNumber },
      });

      if (existingVehicleNumber) {
        throw new BadRequestException('Vehicle number already exists');
      }
    }

    return await this.prisma.vehicle.update({
      where: { driverId },
      data: updateVehicleDto,
      include: {
        owner: true,
      },
    });
  }

  async getVehicle(driverId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
      include: {
        owner: true,
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

    // Check if Aadhar number is already taken
    if (createOwnerDto.aadharNumber) {
      const existingAadhar = await this.prisma.vehicleOwner.findUnique({
        where: { aadharNumber: createOwnerDto.aadharNumber },
      });

      if (existingAadhar) {
        throw new BadRequestException('Aadhar number already exists');
      }
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

    // Check if Aadhar number is being changed and if it's already taken
    if (updateOwnerDto.aadharNumber && updateOwnerDto.aadharNumber !== owner.aadharNumber) {
      const existingAadhar = await this.prisma.vehicleOwner.findUnique({
        where: { aadharNumber: updateOwnerDto.aadharNumber },
      });

      if (existingAadhar) {
        throw new BadRequestException('Aadhar number already exists');
      }
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