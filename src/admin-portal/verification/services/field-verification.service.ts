import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRole, FieldPhotoType, VerificationRequestStatus } from '@prisma/client';
import { AuditActionTypes, AuditLogService, AuditModules } from '../../audit-log/audit-log.service';
import { AdminFirebaseService } from '../../firebase/admin-firebase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadPhotosRequestDto } from '../dto/field-verification-request.dto';

@Injectable()
export class FieldVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly firebaseService: AdminFirebaseService,
  ) {}

  async uploadPhotos(dto: UploadPhotosRequestDto, userId: string, userRole: AdminRole) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: dto.verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (
      verification.status !== VerificationRequestStatus.IN_REVIEW &&
      verification.status !== VerificationRequestStatus.PENDING &&
      verification.status !== VerificationRequestStatus.REVERTED
    ) {
      throw new BadRequestException('Cannot upload photos for this verification status');
    }

    const requiredTypes: FieldPhotoType[] = [
      FieldPhotoType.VEHICLE_FRONT,
      FieldPhotoType.VEHICLE_BACK,
      FieldPhotoType.VEHICLE_LEFT,
      FieldPhotoType.VEHICLE_RIGHT,
      FieldPhotoType.DRIVER_WITH_VEHICLE,
      FieldPhotoType.CHASSIS_NUMBER,
    ];
    const providedTypes = dto.photos.map((p) => p.type as FieldPhotoType);
    const missingTypes = requiredTypes.filter((t) => !providedTypes.includes(t));

    if (missingTypes.length > 0 && !dto.partialUpload) {
      throw new BadRequestException(`Missing required photos: ${missingTypes.join(', ')}`);
    }

    const existingPhotos = await this.prisma.fieldVerificationPhoto.findMany({
      where: { verificationRequestId: dto.verificationId },
    });
    const existingPhotosByType = new Map(
      existingPhotos.map((photo) => [photo.photoType, photo]),
    );

    if (!dto.partialUpload) {
      await this.prisma.fieldVerificationPhoto.deleteMany({
        where: { verificationRequestId: dto.verificationId },
      });
    }

    for (const photo of dto.photos) {
      const photoType = photo.type as FieldPhotoType;
      const existing = existingPhotosByType.get(photoType) ?? null;

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
            photoType,
            url: photo.url,
            uploadedById: userId,
          },
        });
      }

      await this.prisma.verificationDocumentAction.create({
        data: {
          verificationRequestId: dto.verificationId!,
          documentField: `field_photo:${photoType}`,
          action: 'APPROVED',
          actionById: userId,
        },
      });

      await this.auditLog.log({
        userId,
        role: userRole,
        actionType: AuditActionTypes.FIELD_PHOTO_UPLOADED,
        module: AuditModules.FIELD_VERIFICATION,
        description: existing
          ? `Replaced ${photoType} photo for verification ${dto.verificationId}`
          : `Uploaded ${photoType} photo for verification ${dto.verificationId}`,
        entityId: dto.verificationId,
        entityType: 'DriverVerificationRequest',
        beforeSnapshot: {
          photoType,
          url: existing?.url ?? null,
        },
        afterSnapshot: {
          photoType,
          url: photo.url,
        },
      });
    }

    if (verification.status === VerificationRequestStatus.PENDING) {
      await this.prisma.driverVerificationRequest.update({
        where: { id: dto.verificationId },
        data: { status: VerificationRequestStatus.IN_REVIEW },
      });
    }

    return {
      success: true,
      photosUploaded: dto.photos.length,
    };
  }

  async getSignedUploadUrl(
    verificationId: string,
    photoType: string,
    contentType: string,
    fileName: string,
    userId: string,
    userRole: AdminRole,
  ) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const validPhotoTypes = Object.values(FieldPhotoType);
    if (!validPhotoTypes.includes(photoType as FieldPhotoType)) {
      throw new BadRequestException(`Invalid photo type. Must be one of: ${validPhotoTypes.join(', ')}`);
    }

    const validContentTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validContentTypes.includes(contentType.toLowerCase())) {
      throw new BadRequestException('Invalid content type. Only JPEG and PNG images are allowed');
    }

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `field-verification/${verificationId}/${photoType}_${timestamp}_${sanitizedFileName}`;

    const { signedUrl, publicUrl, token } = await this.firebaseService.generateSignedUploadUrl(
      filePath,
      contentType,
      300,
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
