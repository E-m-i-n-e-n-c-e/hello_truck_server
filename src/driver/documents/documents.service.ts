import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDriverDocumentsDto, UpdateDriverDocumentsDto } from '../dtos/documents.dto';
import { DriverDocuments, Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDocuments(
    driverId: string,
    createDocumentsDto: CreateDriverDocumentsDto,
    tx: Prisma.TransactionClient = this.prisma
  ): Promise<DriverDocuments> {
    // Check if documents already exist for this driver
    const existingDocuments = await tx.driverDocuments.findUnique({
      where: { driverId },
    });

    if (existingDocuments) {
      throw new BadRequestException('Documents already exist for this driver');
    }

    const documents = await tx.driverDocuments.create({
      data: {
        ...createDocumentsDto,
        driver: {
          connect: { id: driverId }
        }
      },
    });

    return documents;
  }

  async getDocuments(driverId: string): Promise<DriverDocuments> {
    const documents = await this.prisma.driverDocuments.findUnique({
      where: { driverId },
    });

    if (!documents) {
      throw new NotFoundException('Documents not found for this driver');
    }

    return documents;
  }

  async updateDocuments(
    driverId: string,
    updateDocumentsDto: UpdateDriverDocumentsDto
  ): Promise<DriverDocuments> {
    // Check if documents exist
    const existingDocuments = await this.prisma.driverDocuments.findUnique({
      where: { driverId },
    });

    if (!existingDocuments) {
      throw new NotFoundException('Documents not found for this driver');
    }

    const updatedDocuments = await this.prisma.driverDocuments.update({
      where: { driverId },
      data: updateDocumentsDto,
    });

    return updatedDocuments;
  }

  async getExpiryAlerts(driverId: string): Promise<{
    licenseAlert?: string;
    insuranceAlert?: string;
  }> {
    const documents = await this.getDocuments(driverId);

    if (!documents) {
      throw new BadRequestException('Documents not found for this driver');
    }

    const alerts: { licenseAlert?: string; insuranceAlert?: string } = {};
    const now = new Date();

    // Check license expiry
    const daysUntilLicenseExpiry = Math.ceil(
      (documents.licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilLicenseExpiry <= 10 && daysUntilLicenseExpiry > 0) {
      alerts.licenseAlert = `Your driving license expires in ${daysUntilLicenseExpiry} days. Please renew it soon.`;
    } else if (daysUntilLicenseExpiry === 30) {
      alerts.licenseAlert = 'Your driving license expires in 30 days. Please renew it.';
    } else if (daysUntilLicenseExpiry === 45) {
      alerts.licenseAlert = 'Your driving license expires in 45 days. Please renew it.';
    } else if (daysUntilLicenseExpiry <= 0) {
      alerts.licenseAlert = 'Your driving license has expired. Please renew it immediately.';
    }

    // Check insurance expiry
    const daysUntilInsuranceExpiry = Math.ceil(
      (documents.insuranceExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilInsuranceExpiry <= 10 && daysUntilInsuranceExpiry > 0) {
      alerts.insuranceAlert = `Your insurance expires in ${daysUntilInsuranceExpiry} days. Please renew it soon.`;
    } else if (daysUntilInsuranceExpiry === 30) {
      alerts.insuranceAlert = 'Your insurance expires in 30 days. Please renew it.';
    } else if (daysUntilInsuranceExpiry === 45) {
      alerts.insuranceAlert = 'Your insurance expires in 45 days. Please renew it.';
    } else if (daysUntilInsuranceExpiry <= 0) {
      alerts.insuranceAlert = 'Your insurance has expired. Please renew it immediately.';
    }

    return alerts;
  }
}