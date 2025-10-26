import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDriverAddressDto, UpdateDriverAddressDto } from '../dtos/address.dto';
import { DriverAddress, Prisma } from '@prisma/client';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async createAddress(driverId: string, createAddressDto: CreateDriverAddressDto, tx: Prisma.TransactionClient = this.prisma): Promise<DriverAddress> {
    // Check if address already exists for this driver
    const existingAddress = await tx.driverAddress.findUnique({
      where: { driverId },
    });

    if (existingAddress) {
      throw new BadRequestException('Address already exists for this driver');
    }

    const address = await tx.driverAddress.create({
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
    updateAddressDto: UpdateDriverAddressDto,
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