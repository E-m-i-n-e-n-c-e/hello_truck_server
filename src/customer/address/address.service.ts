import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSavedAddressDto, UpdateSavedAddressDto } from '../dtos/address.dto';
import { Prisma, SavedAddress } from '@prisma/client';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async createSavedAddress(userId: string, createSavedAddressDto: CreateSavedAddressDto, tx: Prisma.TransactionClient = this.prisma): Promise<SavedAddress> {
    // If this is the first address or isDefault is true, handle default address setting
    if (createSavedAddressDto.isDefault) {
      await tx.savedAddress.updateMany({
        where: { customerId: userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // If this is the first address, make it default regardless of input
    const addressCount = await tx.savedAddress.count({
      where: { customerId: userId },
    });
    const { address: addressData, ...savedAddressData } = createSavedAddressDto;
    try {
    const address = await tx.savedAddress.create({
      data: {
        ...savedAddressData,
        isDefault: addressCount === 0 ? true : createSavedAddressDto.isDefault ?? false,
        customer: {
          connect: { id: userId },
        },
        address: {
          create: addressData,
        },
      },
    });

      return address;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          if (target?.includes('unique_name_per_customer')) {
            throw new BadRequestException('Address name already exists for this customer');
          }
        }
      }
      throw error;
    }
  }

  async getSavedAddresses(userId: string): Promise<SavedAddress[]> {
    return this.prisma.savedAddress.findMany({
      where: { customerId: userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        address: true,
      },
    });
  }

  async getSavedAddressById(userId: string, id: string): Promise<SavedAddress> {
    const address = await this.prisma.savedAddress.findFirst({
      where: { id, customerId: userId },
      include: {
        address: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  async updateSavedAddress(
    userId: string,
    id: string,
    updateSavedAddressDto: UpdateSavedAddressDto,
  ): Promise<SavedAddress> {
    const address = await this.prisma.savedAddress.findFirst({
      where: { id, customerId: userId },
      include: {
        address: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Handle default address changes in a transaction
    if (updateSavedAddressDto.isDefault) {
      await this.prisma.savedAddress.updateMany({
        where: { customerId: userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const { address: addressData, ...savedAddressData } = updateSavedAddressDto;
    try {
    return this.prisma.savedAddress.update({
      where: { id },
      data: {
        ...savedAddressData,
        address: {
          update: addressData,
        },
      },
    });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          if (target?.includes('unique_name_per_customer')) {
            throw new BadRequestException('Address name already exists for this customer');
          }
        }
      }
      throw error;
    }
  }

  async deleteSavedAddress(userId: string, id: string): Promise<void> {
    const address = await this.prisma.savedAddress.findFirst({
      where: { id, customerId: userId },
      include: {
        address: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    await this.prisma.savedAddress.delete({
      where: { id },
    });

    // If the deleted address was default and other addresses exist, make the most recent one default
    if (address.isDefault) {
      const remainingAddress = await this.prisma.savedAddress.findFirst({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
      });

      if (remainingAddress) {
        await this.prisma.savedAddress.update({
          where: { id: remainingAddress.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async setDefaultSavedAddress(userId: string, id: string): Promise<SavedAddress> {
    const address = await this.prisma.savedAddress.findFirst({
      where: { id, customerId: userId },
      include: {
        address: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Handle default address change in a transaction
    await this.prisma.$transaction([
      this.prisma.savedAddress.updateMany({
        where: { customerId: userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.savedAddress.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return this.getSavedAddressById(userId, id);
  }

  async deleteAllSavedAddresses(userId: string): Promise<void> {
    await this.prisma.savedAddress.deleteMany({
      where: { customerId: userId },
    });
  }
}