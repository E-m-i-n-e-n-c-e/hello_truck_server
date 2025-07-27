import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dto';
import { CustomerAddress } from '@prisma/client';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async createAddress(userId: string, createAddressDto: CreateAddressDto): Promise<CustomerAddress> {
    // If this is the first address or isDefault is true, handle default address setting
    if (createAddressDto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // If this is the first address, make it default regardless of input
    const addressCount = await this.prisma.customerAddress.count({
      where: { customerId: userId },
    });

    const address = await this.prisma.customerAddress.create({
      data: {
        ...createAddressDto,
        isDefault: addressCount === 0 ? true : createAddressDto.isDefault ?? false,
        customer: {
          connect: { id: userId },
        },
      },
    });

    return address;
  }

  async getAddresses(userId: string): Promise<CustomerAddress[]> {
    return this.prisma.customerAddress.findMany({
      where: { customerId: userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getAddressById(userId: string, id: string): Promise<CustomerAddress> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id, customerId: userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async updateAddress(
    userId: string,
    id: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<CustomerAddress> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id, customerId: userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Handle default address changes in a transaction
    if (updateAddressDto.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId: userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.customerAddress.update({
      where: { id },
      data: updateAddressDto,
    });
  }

  async deleteAddress(userId: string, id: string): Promise<void> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id, customerId: userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.customerAddress.delete({
      where: { id },
    });

    // If the deleted address was default and other addresses exist, make the most recent one default
    if (address.isDefault) {
      const remainingAddress = await this.prisma.customerAddress.findFirst({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
      });

      if (remainingAddress) {
        await this.prisma.customerAddress.update({
          where: { id: remainingAddress.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async setDefaultAddress(userId: string, id: string): Promise<CustomerAddress> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id, customerId: userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Handle default address change in a transaction
    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({
        where: { customerId: userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.customerAddress.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return this.getAddressById(userId, id);
  }

  async deleteAllAddresses(userId: string): Promise<void> {
    await this.prisma.customerAddress.deleteMany({
      where: { customerId: userId },
    });
  }
}