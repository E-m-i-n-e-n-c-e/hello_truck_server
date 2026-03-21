import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../../driver/documents/documents.service';
import { ACTIVE_VERIFICATION_REQUEST_STATUSES } from '../../admin-portal/verification/utils/verification.constants';

@Injectable()
export class VerificationRequestService {
  private readonly logger = new Logger(VerificationRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
  ) {}

  /**
   * Create verification requests for drivers who need them
   * Requirements:
   * - No active verification request
   * - Has PENDING verification status OR has PENDING documents
   * - Has completed onboarding (firstName exists AND documents exist)
   */
  async createMissingVerificationRequests(): Promise<void> {
    try {
      this.logger.log('Checking for drivers needing verification requests...');

      // Find drivers who meet all criteria
      const driversNeedingVerification = await this.prisma.driver.findMany({
        where: {
          // Must have completed onboarding
          firstName: { not: null },
          documents: { isNot: null },
          // Must have PENDING status OR PENDING documents
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
          // No active verification request
          verificationRequests: {
            none: {
              status: {
                in: ACTIVE_VERIFICATION_REQUEST_STATUSES,
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
