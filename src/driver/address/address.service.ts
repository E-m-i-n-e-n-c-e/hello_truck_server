import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dto';
import { DriverAddress } from '@prisma/client';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async createAddress(driverId: string, createAddressDto: CreateAddressDto): Promise<DriverAddress> {
    // Check if address already exists for this driver
    const existingAddress = await this.prisma.driverAddress.findUnique({
      where: { driverId },
    });

    if (existingAddress) {
      throw new BadRequestException('Address already exists for this driver');
    }

    const address = await this.prisma.driverAddress.create({
      data: {
        ...createAddressDto,
        driver: {
          connect: { id: driverId },
        },
      },
    });

    return address;
  }

  async getAddress(driverId: string): Promise<DriverAddress> {
    const address = await this.prisma.driverAddress.findUnique({
      where: { driverId },
    });

    if (!address) {
      throw new NotFoundException('Address not found for this driver');
    }

    return address;
  }

  async updateAddress(
    driverId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<DriverAddress> {
    const address = await this.prisma.driverAddress.findUnique({
      where: { driverId },
    });

    if (!address) {
      throw new NotFoundException('Address not found for this driver');
    }

    return this.prisma.driverAddress.update({
      where: { driverId },
      data: updateAddressDto,
    });
  }

  async deleteAddress(driverId: string): Promise<void> {
    const address = await this.prisma.driverAddress.findUnique({
      where: { driverId },
    });

    if (!address) {
      throw new NotFoundException('Address not found for this driver');
    }

    await this.prisma.driverAddress.delete({
      where: { driverId },
    });
  }
}