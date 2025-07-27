import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGstDetailsDto, UpdateGstDetailsDto } from '../dtos/gst-details.dto';
import { CustomerGstDetails, Prisma } from '@prisma/client';

@Injectable()
export class GstService {
  constructor(private prisma: PrismaService) {}

  async addGstDetails(userId: string, createGstDetailsDto: CreateGstDetailsDto, tx: Prisma.TransactionClient= this.prisma) {
    const existingGst = await tx.customerGstDetails.findUnique({
      where: { gstNumber: createGstDetailsDto.gstNumber }
    });

    if (existingGst) {
      // If the GST details are not active, reactivate them
      if(!existingGst.isActive && existingGst.customerId === userId) {
        throw new BadRequestException('GST number already exists but is inactive. Please reactivate it.');
      }
      throw new BadRequestException('GST number already exists');
    }

    await tx.customerGstDetails.create({
      data: {
        ...createGstDetailsDto,
        customer: {
            connect: { id: userId }
          }
        },
      });

    return {success:true, message:'GST details added successfully'};
  }

  async getGstDetails(userId: string): Promise<CustomerGstDetails[]> {
    const gstDetails = await this.prisma.customerGstDetails.findMany({
      where: { customerId: userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return gstDetails;
  }

  async getGstDetailsById(userId: string, id: string): Promise<CustomerGstDetails> {
    const gstDetails = await this.prisma.customerGstDetails.findUnique({
      where: { id, customerId: userId, isActive: true },
    });

    if (!gstDetails) {
      throw new NotFoundException('GST details not found');
    }

    return gstDetails;
  }

  async updateGstDetails(userId: string, id: string, updateGstDetailsDto: UpdateGstDetailsDto) {
    let gstDetails: Prisma.BatchPayload;

    try {
      gstDetails = await this.prisma.customerGstDetails.updateMany({
        where: { id, customerId: userId, isActive: true },
        data: updateGstDetailsDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('GST number already exists');
        }
      }
      throw error;
    }

    if(gstDetails.count === 0) {
      throw new NotFoundException('No active GST details found to update');
    }

    return {success:true, message:'GST details updated successfully'};
  }

  async deactivateGstDetails(userId: string, id: string) {
    const gstDetails = await this.prisma.customerGstDetails.updateMany({
      where: { id, customerId: userId, isActive: true },
      data: { isActive: false }
    });

    if(gstDetails.count === 0) {
      throw new NotFoundException('GST details not found');
    }

    return {success:true, message:'GST details deactivated successfully'};
  }

  async reactivateGstDetails(userId: string, gstNumber: string) {
    const gstDetails = await this.prisma.customerGstDetails.updateMany({
      where: { gstNumber, customerId: userId, isActive: false },
      data: { isActive: true }
    });

    if(gstDetails.count === 0) {
      throw new NotFoundException('GST details not found');
    }

    return {success:true, message:'GST details reactivated successfully'};
  }
}