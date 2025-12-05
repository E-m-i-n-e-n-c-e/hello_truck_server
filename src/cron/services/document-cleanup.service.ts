import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentCleanupService {
  constructor(private prisma: PrismaService) {}

  async checkExpiredDocuments() {
    const now = new Date();

    // 1. Expire Licenses
    const expiredLicenses = await this.prisma.driverDocuments.updateMany({
      where: {
        licenseExpiry: { lt: now },
        licenseStatus: 'VERIFIED'
      },
      data: { licenseStatus: 'PENDING' }
    });

    // 2. Expire FCs
    const expiredFCs = await this.prisma.driverDocuments.updateMany({
      where: {
        fcExpiry: { lt: now },
        fcStatus: 'VERIFIED'
      },
      data: { fcStatus: 'PENDING' }
    });

    // 3. Expire Insurance
    const expiredInsurances = await this.prisma.driverDocuments.updateMany({
      where: {
        insuranceExpiry: { lt: now },
        insuranceStatus: 'VERIFIED'
      },
      data: { insuranceStatus: 'PENDING' }
    });

    console.log(`Expired docs: License=${expiredLicenses.count}, FC=${expiredFCs.count}, Insurance=${expiredInsurances.count}.`);

    // 4. Update Driver status to PENDING ONLY if they have EXPIRED documents
    const demotedDrivers = await this.prisma.driver.updateMany({
      where: {
        verificationStatus: 'VERIFIED',
        documents: {
          OR: [
            { licenseExpiry: { lt: now } },
            { fcExpiry: { lt: now } },
            { insuranceExpiry: { lt: now } }
          ]
        }
      },
      data: { verificationStatus: 'PENDING' }
    });

    console.log(`Demoted ${demotedDrivers.count} drivers due to expired documents.`);
  }
}
