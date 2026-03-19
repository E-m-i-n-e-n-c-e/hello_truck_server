import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../../driver/documents/documents.service';

@Injectable()
export class VerificationRequestService {
  private readonly logger = new Logger(VerificationRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
  ) {}

  /**
   * Create verification requests for drivers who need them
   * Targets drivers with PENDING status or PENDING documents but no active verification request
   */
  async createMissingVerificationRequests(): Promise<void> {
    try {
      this.logger.log('Checking for drivers needing verification requests...');

      // Find drivers with PENDING verification status or PENDING documents
      // who don't have an active verification request
      const driversNeedingVerification = await this.prisma.driver.findMany({
        where: {
          OR: [
            { verificationStatus: 'PENDING' },
            {
              documents: {
                OR: [
                  { licenseStatus: 'PENDING' },
                  { rcBookStatus: 'PENDING' },
                  { fcStatus: 'PENDING' },
                  { insuranceStatus: 'PENDING' },
                ],
              },
            },
          ],
          verificationRequests: {
            none: {
              status: {
                in: ['PENDING', 'APPROVED', 'REVERT_REQUESTED', 'REVERTED'],
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (driversNeedingVerification.length === 0) {
        this.logger.log('No drivers need verification requests.');
        return;
      }

      this.logger.log(
        `Found ${driversNeedingVerification.length} drivers needing verification requests.`,
      );

      // Create verification requests for each driver
      let successCount = 0;
      let failCount = 0;

      for (const driver of driversNeedingVerification) {
        try {
          await this.documentsService.autoCreateVerificationRequest(driver.id);
          successCount++;
        } catch (error) {
          failCount++;
          this.logger.error(
            `Failed to create verification request for driver ${driver.id}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Verification request creation completed. Success: ${successCount}, Failed: ${failCount}`,
      );
    } catch (error) {
      this.logger.error('Error in createMissingVerificationRequests:', error);
    }
  }
}
