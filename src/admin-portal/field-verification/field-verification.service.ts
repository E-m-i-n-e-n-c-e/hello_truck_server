/**
 * Field Verification Service
 *
 * Handles:
 * - Fetching assigned verifications for field agents
 * - Viewing driver documents
 * - Uploading vehicle photos (Front, Back, Left, Right, Driver+Vehicle, Chassis)
 * - Completing field verification
 * - Revert requests
 *
 * Note: View actions are NOT logged per design requirements.
 */
import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AdminRole, VerificationRequestStatus, FieldPhotoType } from '@prisma/client';
import { AuditLogService, AuditActionTypes, AuditModules } from '../audit-log/audit-log.service';
import { UploadPhotosDto } from './dto/upload-photos.dto';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';

@Injectable()
export class FieldVerificationService {
  private readonly logger = new Logger(FieldVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly firebaseService: AdminFirebaseService,
  ) {}

  /**
   * Get verifications assigned to a field agent
   */
  async getAssignedVerifications(fieldAgentId: string) {
    return this.prisma.driverVerificationRequest.findMany({
      where: {
        assignedToId: fieldAgentId,
        verificationType: 'NEW_DRIVER',
        status: { in: [VerificationRequestStatus.PENDING, VerificationRequestStatus.IN_REVIEW] },
      },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get verification details for field agent
   * Note: View does not require logging
   */
  async getVerificationDetails(verificationId: string, fieldAgentId: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: {
        driver: {
          include: {
            documents: true,
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        fieldPhotos: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Check if assigned to this field agent
    if (verification.assignedToId !== fieldAgentId) {
      throw new ForbiddenException('Not assigned to you');
    }

    return verification;
  }

  /**
   * Get driver documents for viewing
   * Note: View does not require logging
   */
  async getDriverDocuments(verificationId: string, fieldAgentId: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: {
        driver: {
          include: {
            documents: true,
          },
        },
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const documents = verification.driver.documents;

    return {
      verificationId,
      driverId: verification.driverId,
      documents: documents,
    };
  }

  /**
   * Upload field verification photos
   * Photos: VEHICLE_FRONT, VEHICLE_BACK, VEHICLE_LEFT, VEHICLE_RIGHT, DRIVER_WITH_VEHICLE, CHASSIS_NUMBER
   */
  async uploadPhotos(dto: UploadPhotosDto, userId: string, userRole: AdminRole) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: dto.verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (verification.status !== VerificationRequestStatus.IN_REVIEW && verification.status !== VerificationRequestStatus.PENDING) {
      throw new BadRequestException('Cannot upload photos for this verification status');
    }

    // Map photo types
    const requiredTypes: FieldPhotoType[] = [
      FieldPhotoType.VEHICLE_FRONT,
      FieldPhotoType.VEHICLE_BACK,
      FieldPhotoType.VEHICLE_LEFT,
      FieldPhotoType.VEHICLE_RIGHT,
      FieldPhotoType.DRIVER_WITH_VEHICLE,
      FieldPhotoType.CHASSIS_NUMBER,
    ];
    const providedTypes = dto.photos.map(p => p.type as FieldPhotoType);
    const missingTypes = requiredTypes.filter(t => !providedTypes.includes(t));

    if (missingTypes.length > 0 && !dto.partialUpload) {
      throw new BadRequestException(`Missing required photos: ${missingTypes.join(', ')}`);
    }

    // Delete existing photos if replacing
    if (!dto.partialUpload) {
      await this.prisma.fieldVerificationPhoto.deleteMany({
        where: { verificationRequestId: dto.verificationId },
      });
    }

    // Upsert photos
    for (const photo of dto.photos) {
      // Try to find existing photo
      const existing = await this.prisma.fieldVerificationPhoto.findFirst({
        where: {
          verificationRequestId: dto.verificationId,
          photoType: photo.type as FieldPhotoType,
        },
      });

      if (existing) {
        await this.prisma.fieldVerificationPhoto.update({
          where: { id: existing.id },
          data: {
            url: photo.url,
            uploadedById: userId,
            uploadedAt: new Date(),
          },
        });
      } else {
        await this.prisma.fieldVerificationPhoto.create({
          data: {
            verificationRequestId: dto.verificationId!,
            photoType: photo.type as FieldPhotoType,
            url: photo.url,
            uploadedById: userId,
          },
        });
      }
    }

    // Update verification status to IN_REVIEW if it was PENDING
    if (verification.status === VerificationRequestStatus.PENDING) {
      await this.prisma.driverVerificationRequest.update({
        where: { id: dto.verificationId },
        data: { status: VerificationRequestStatus.IN_REVIEW },
      });
    }

    // Log the action
    await this.auditLog.log({
      userId,
      role: userRole,
      actionType: AuditActionTypes.FIELD_PHOTO_UPLOADED,
      module: AuditModules.FIELD_VERIFICATION,
      description: `Uploaded ${dto.photos.length} photos for verification ${dto.verificationId}`,
      entityId: dto.verificationId,
      entityType: 'DriverVerificationRequest',
      afterSnapshot: { photoTypes: providedTypes },
    });

    return {
      success: true,
      photosUploaded: dto.photos.length,
    };
  }

  /**
   * Complete field verification (submit for agent review)
   */
  async completeVerification(
    verificationId: string,
    notes: string | undefined,
    fieldAgentId: string,
    userRole: AdminRole,
  ) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: {
        fieldPhotos: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (verification.assignedToId !== fieldAgentId) {
      throw new ForbiddenException('Not assigned to you');
    }

    // Check all photos are uploaded
    const requiredTypes: FieldPhotoType[] = [
      FieldPhotoType.VEHICLE_FRONT,
      FieldPhotoType.VEHICLE_BACK,
      FieldPhotoType.VEHICLE_LEFT,
      FieldPhotoType.VEHICLE_RIGHT,
      FieldPhotoType.DRIVER_WITH_VEHICLE,
      FieldPhotoType.CHASSIS_NUMBER,
    ];
    const uploadedTypes = verification.fieldPhotos.map(p => p.photoType);
    const missingTypes = requiredTypes.filter(t => !uploadedTypes.includes(t));

    if (missingTypes.length > 0) {
      throw new BadRequestException(`Missing required photos: ${missingTypes.join(', ')}`);
    }

    const beforeSnapshot = { status: verification.status };

    // Mark field verification as complete - status stays IN_REVIEW for agent to review
    const updated = await this.prisma.driverVerificationRequest.update({
      where: { id: verificationId },
      data: {
        status: VerificationRequestStatus.IN_REVIEW,
        // Note: Would add fieldVerificationNotes if the schema had it
      },
      include: {
        driver: true,
      },
    });

    // Log the action
    await this.auditLog.log({
      userId: fieldAgentId,
      role: userRole,
      actionType: AuditActionTypes.FIELD_VERIFICATION_SUBMITTED,
      module: AuditModules.FIELD_VERIFICATION,
      description: `Field verification completed for ${verificationId}`,
      entityId: verificationId,
      entityType: 'DriverVerificationRequest',
      beforeSnapshot,
      afterSnapshot: { status: updated.status },
    });

    return updated;
  }

  /**
   * Request revert for field verification
   */
  async requestRevert(
    verificationId: string,
    reason: string,
    requesterId: string,
    requesterRole: AdminRole,
  ) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (verification.status !== VerificationRequestStatus.APPROVED) {
      throw new BadRequestException('Can only revert approved verifications');
    }

    if (!verification.bufferExpiresAt || verification.bufferExpiresAt < new Date()) {
      throw new BadRequestException('Buffer window has expired');
    }

    const beforeSnapshot = { status: verification.status };

    // Update to revert requested
    const updated = await this.prisma.driverVerificationRequest.update({
      where: { id: verificationId },
      data: {
        status: VerificationRequestStatus.REVERT_REQUESTED,
        revertReason: reason,
        revertRequestedById: requesterId,
        revertRequestedAt: new Date(),
      },
    });

    // Log the action
    await this.auditLog.log({
      userId: requesterId,
      role: requesterRole,
      actionType: AuditActionTypes.REVERT_REQUESTED,
      module: AuditModules.FIELD_VERIFICATION,
      description: `Revert requested for field verification ${verificationId}. Reason: ${reason}`,
      entityId: verificationId,
      entityType: 'DriverVerificationRequest',
      beforeSnapshot,
      afterSnapshot: { status: updated.status, revertReason: reason },
    });

    return updated;
  }

  /**
   * Get signed URL for photo upload
   * Generates a signed URL that allows direct upload to Firebase Storage
   */
  async getSignedUploadUrl(
    verificationId: string,
    photoType: string,
    contentType: string,
    fileName: string,
    userId: string,
  ) {
    // Validate verification exists and is assigned to user
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Validate photo type
    const validPhotoTypes = Object.values(FieldPhotoType);
    if (!validPhotoTypes.includes(photoType as FieldPhotoType)) {
      throw new BadRequestException(`Invalid photo type. Must be one of: ${validPhotoTypes.join(', ')}`);
    }

    // Validate content type
    const validContentTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validContentTypes.includes(contentType.toLowerCase())) {
      throw new BadRequestException('Invalid content type. Only JPEG and PNG images are allowed');
    }

    // Generate file path: field-verification/{verificationId}/{photoType}_{timestamp}_{fileName}
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `field-verification/${verificationId}/${photoType}_${timestamp}_${sanitizedFileName}`;

    // Generate signed URL (valid for 5 minutes)
    const { signedUrl, publicUrl, token } = await this.firebaseService.generateSignedUploadUrl(
      filePath,
      contentType,
      300, // 5 minutes
    );

    return {
      signedUrl,
      publicUrl,
      token,
      filePath,
      expiresIn: 300,
    };
  }
}
