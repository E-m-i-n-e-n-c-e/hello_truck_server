import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class DocumentCleanupService {
  private readonly logger = new Logger(DocumentCleanupService.name);
  constructor(private prisma: PrismaService) {}

  async checkExpiredDocuments() {
    const now = new Date();

    // 1. Expire Licenses
    const expiredLicenses = await this.prisma.driverDocuments.updateMany({
      where: {
        licenseExpiry: { lt: now },
        licenseStatus: 'VERIFIED',
      },
      data: { licenseStatus: 'PENDING' },
    });

    // 2. Expire FCs
    const expiredFCs = await this.prisma.driverDocuments.updateMany({
      where: {
        fcExpiry: { lt: now },
        fcStatus: 'VERIFIED',
      },
      data: { fcStatus: 'PENDING' },
    });

    // 3. Expire Insurance
    const expiredInsurances = await this.prisma.driverDocuments.updateMany({
      where: {
        insuranceExpiry: { lt: now },
        insuranceStatus: 'VERIFIED',
      },
      data: { insuranceStatus: 'PENDING' },
    });

    // 4. Expire RC Books
    const expiredRcBooks = await this.prisma.driverDocuments.updateMany({
      where: {
        rcBookExpiry: { lt: now },
        rcBookStatus: 'VERIFIED',
      },
      data: { rcBookStatus: 'PENDING' },
    });

    this.logger.log(
      `Expired docs: License=${expiredLicenses.count}, FC=${expiredFCs.count}, Insurance=${expiredInsurances.count}, RCBook=${expiredRcBooks.count}.`,
    );

    // 5. Update Driver status to PENDING ONLY if they have EXPIRED documents
    const demotedDrivers = await this.prisma.driver.updateMany({
      where: {
        verificationStatus: 'VERIFIED',
        documents: {
          OR: [
            { licenseExpiry: { lt: now } },
            { fcExpiry: { lt: now } },
            { insuranceExpiry: { lt: now } },
            { rcBookExpiry: { lt: now } },
          ],
        },
      },
      data: { verificationStatus: 'PENDING' },
    });

    this.logger.log(
      `Demoted ${demotedDrivers.count} drivers due to expired documents.`,
    );
  }
}
