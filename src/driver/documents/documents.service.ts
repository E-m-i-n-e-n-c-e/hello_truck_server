import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateDriverDocumentsDto,
  UpdateDriverDocumentsDto,
} from '../dtos/documents.dto';
import { DriverDocuments, Prisma, VerificationStatus } from '@prisma/client';
import { FirebaseService } from 'src/firebase/firebase.service';
import { uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from 'src/config/env.config';
import { createLibreDeskTicket } from 'src/common/utils/libredesk.util';

@Injectable()
export class DocumentsService {
  private readonly ENCRYPTION_KEY: Buffer;
  private readonly ALGORITHM = 'aes-256-cbc';
  private readonly IV_LENGTH = 16;

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    // Get encryption key from environment variable
    const key = process.env.AADHAR_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('AADHAR_ENCRYPTION_KEY environment variable is not set');
    }
    // Ensure key is 32 bytes for AES-256
    this.ENCRYPTION_KEY = crypto.createHash('sha256').update(key).digest();
  }

  private hashAadhar(aadharNumber: string): string {
    return crypto.createHash('sha256').update(aadharNumber).digest('hex');
  }

  private encryptAadhar(aadharNumber: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(
      this.ALGORITHM,
      this.ENCRYPTION_KEY,
      iv,
    );
    let encrypted = cipher.update(aadharNumber, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Return IV + encrypted data (IV is needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptAadhar(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      this.ENCRYPTION_KEY,
      iv,
    );
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async createDocuments(
    driverId: string,
    createDocumentsDto: CreateDriverDocumentsDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<DriverDocuments> {
    // Check if documents already exist for this driver
    const existingDocuments = await tx.driverDocuments.findUnique({
      where: { driverId },
    });

    if (existingDocuments) {
      throw new BadRequestException('Documents already exist for this driver');
    }

    // Hash and encrypt the Aadhaar number
    const aadharNumberHash = this.hashAadhar(createDocumentsDto.aadharNumber);
    const aadharNumberEncrypted = this.encryptAadhar(
      createDocumentsDto.aadharNumber,
    );

    // Check for duplicate Aadhaar among active verified drivers
    await this.checkAadharDuplicate(aadharNumberHash, driverId, tx);

    // Check for duplicate PAN among active verified drivers
    await this.checkPanDuplicate(createDocumentsDto.panNumber, driverId, tx);

    try {
      // Normalize suggested expiry strings to Date objects (if provided)
      const suggestedExpiryDates = {
        suggestedLicenseExpiry: createDocumentsDto.suggestedLicenseExpiry
          ? new Date(createDocumentsDto.suggestedLicenseExpiry)
          : undefined,
        suggestedFcExpiry: createDocumentsDto.suggestedFcExpiry
          ? new Date(createDocumentsDto.suggestedFcExpiry)
          : undefined,
        suggestedInsuranceExpiry: createDocumentsDto.suggestedInsuranceExpiry
          ? new Date(createDocumentsDto.suggestedInsuranceExpiry)
          : undefined,
        suggestedRcBookExpiry: createDocumentsDto.suggestedRcBookExpiry
          ? new Date(createDocumentsDto.suggestedRcBookExpiry)
          : undefined,
      };

      // Remove aadharNumber from the data to be saved (we only store hash and encrypted)
      const { aadharNumber, ...documentsData } = createDocumentsDto;

      const documents = await tx.driverDocuments.create({
        data: {
          ...documentsData,
          ...suggestedExpiryDates,
          aadharNumberHash,
          aadharNumberEncrypted,
          driver: {
            connect: { id: driverId },
          },
        },
      });

      // Auto-create verification request (fire-and-forget)
      // Don't await - let it run in background
      this.autoCreateVerificationRequest(driverId);

      return documents;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation
          const target = error.meta?.target as string[];
          if (target?.includes('panNumber')) {
            throw new BadRequestException(
              'This PAN number is already registered. Please use a different PAN number.',
            );
          }
        }
      }
      throw error;
    }
  }

  private async checkAadharDuplicate(
    aadharNumberHash: string,
    excludeDriverId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    // Find any active verified driver with the same Aadhaar hash
    const existingDriver = await tx.driverDocuments.findFirst({
      where: {
        aadharNumberHash,
        driverId: { not: excludeDriverId },
        driver: {
          isActive: true,
          verificationStatus: { not: VerificationStatus.REJECTED },
        },
      },
      include: {
        driver: {
          select: {
            phoneNumber: true,
          },
        },
      },
    });

    if (existingDriver) {
      throw new BadRequestException(
        'This Aadhaar number is already registered with an active verified driver account.',
      );
    }
  }

  private async checkPanDuplicate(
    panNumber: string,
    excludeDriverId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    // Find any active verified driver with the same PAN
    const existingDriver = await tx.driverDocuments.findFirst({
      where: {
        panNumber,
        driverId: { not: excludeDriverId },
        driver: {
          isActive: true,
          verificationStatus: { not: VerificationStatus.REJECTED },
        },
      },
      include: {
        driver: {
          select: {
            phoneNumber: true,
          },
        },
      },
    });

    if (existingDriver) {
      throw new BadRequestException(
        'This PAN number is already registered with an active verified driver account.',
      );
    }
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
    updateDocumentsDto: UpdateDriverDocumentsDto,
  ): Promise<DriverDocuments> {
    // Check if documents exist
    const existingDocuments = await this.prisma.driverDocuments.findUnique({
      where: { driverId },
    });

    if (!existingDocuments) {
      throw new NotFoundException('Documents not found for this driver');
    }

    // Prepare update data with status resets
    const data: any = { ...updateDocumentsDto };

    // Normalize suggested expiry strings to Date objects (if provided)
    if (updateDocumentsDto.suggestedLicenseExpiry) {
      data.suggestedLicenseExpiry = new Date(
        updateDocumentsDto.suggestedLicenseExpiry,
      );
    }
    if (updateDocumentsDto.suggestedFcExpiry) {
      data.suggestedFcExpiry = new Date(updateDocumentsDto.suggestedFcExpiry);
    }
    if (updateDocumentsDto.suggestedInsuranceExpiry) {
      data.suggestedInsuranceExpiry = new Date(
        updateDocumentsDto.suggestedInsuranceExpiry,
      );
    }
    if (updateDocumentsDto.suggestedRcBookExpiry) {
      data.suggestedRcBookExpiry = new Date(
        updateDocumentsDto.suggestedRcBookExpiry,
      );
    }

    // If license is updated, reset status
    if (updateDocumentsDto.licenseUrl) {
      data.licenseStatus = 'PENDING';
    }
    // If FC is updated, reset status
    if (updateDocumentsDto.fcUrl) {
      data.fcStatus = 'PENDING';
    }
    // If Insurance is updated, reset status
    if (updateDocumentsDto.insuranceUrl) {
      data.insuranceStatus = 'PENDING';
    }
    // If RC Book is updated, reset status
    if (updateDocumentsDto.rcBookUrl) {
      data.rcBookStatus = 'PENDING';
    }

    const updatedDocuments = await this.prisma.driverDocuments.update({
      where: { driverId },
      data: data,
    });

    // Auto-create verification request for re-verification (fire-and-forget)
    // Don't await - let it run in background
    this.autoCreateVerificationRequest(driverId);

    return updatedDocuments;
  }

  /**
   * Auto-create verification request (fire-and-forget helper)
   * This is called after document creation/update to ensure verification request exists
   *
   * NOTE: We directly create the request here to avoid circular dependency with admin-portal module
   */
  private async autoCreateVerificationRequest(driverId: string): Promise<void> {
    try {
      // Single query: Find driver and include existing verification requests with status filter
      const driver = await this.prisma.driver.findUnique({
        where: { id: driverId },
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
          verificationStatus: true,
          verificationRequests: {
            where: {
              status: {
                in: ['PENDING', 'APPROVED', 'REVERT_REQUESTED'],
              },
            },
            select: { id: true },
            take: 1, // Only need to know if at least one exists
          },
        },
      });

      if (!driver) {
        return; // Driver not found, skip
      }

      // Check if existing request found (count > 0)
      if (driver.verificationRequests && driver.verificationRequests.length > 0) {
        return; // Request already exists
      }

      // Determine verification type based on driver status
      const verificationType = driver.verificationStatus === VerificationStatus.VERIFIED
        ? 'EXISTING_DRIVER'
        : 'NEW_DRIVER';

      const driverName = driver.lastName ? `${driver.firstName} ${driver.lastName}`: driver.firstName;

      // Create LibreDesk ticket first
      const ticketId = await createLibreDeskTicket(
        {
          driverName: driverName || 'Unknown Driver',
          driverPhone: driver.phoneNumber,
          driverId,
          verificationType,
        },
        {
          apiUrl: this.configService.get('LIBREDESK_API_URL', { infer: true })!,
          apiKey: this.configService.get('LIBREDESK_API_KEY', { infer: true })!,
          apiSecret: this.configService.get('LIBREDESK_API_SECRET', {
            infer: true,
          })!,
          inboxId: this.configService.get('LIBREDESK_INBOX_ID', {
            infer: true,
          })!,
        },
      );

      // Create PENDING verification request with ticket ID
      await this.prisma.driverVerificationRequest.create({
        data: {
          driverId,
          verificationType,
          status: 'PENDING',
          ticketId,
        },
      });
    } catch (error) {
      // Silently fail - this is best-effort background task
      console.error(`Failed to auto-create verification request for driver ${driverId}:`, error);
    }
  }

  async getUploadUrl(
    driverId: string,
    uploadUrlDto: uploadUrlDto,
  ): Promise<{
    signedUrl: string;
    publicUrl: string;
    token: string;
  }> {
    const uploadUrl = await this.firebaseService.generateSignedUploadUrl(
      uploadUrlDto.filePath,
      uploadUrlDto.type,
    );
    return uploadUrl;
  }

  async validateAadharNumber(
    aadharNumber: string,
    driverId?: string,
  ): Promise<{ isAvailable: boolean }> {
    const aadharNumberHash = this.hashAadhar(aadharNumber);

    try {
      await this.checkAadharDuplicate(
        aadharNumberHash,
        driverId || '',
        this.prisma,
      );
      return { isAvailable: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        return { isAvailable: false };
      }
      throw error;
    }
  }

  async validatePanNumber(
    panNumber: string,
    driverId?: string,
  ): Promise<{ isAvailable: boolean }> {
    try {
      await this.checkPanDuplicate(panNumber, driverId || '', this.prisma);
      return { isAvailable: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        return { isAvailable: false };
      }
      throw error;
    }
  }
}
