import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminRole,
  DriverVerificationType,
  FieldPhotoType,
  Prisma,
  VerificationRequestStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VerificationQueueService } from './verification-queue.service';
import { AdminFirebaseService } from '../../firebase/admin-firebase.service';
import {
  AssignVerificationRequestDto,
  CreateVerificationRequestDto,
  ListVerificationDriversRequestDto,
  RevertDecisionRequestDto,
} from '../dto/verification-request.dto';
import { AUDIT_METADATA_KEY } from '../../audit-log/decorators/audit-log.decorator';
import {
  ACTIVE_VERIFICATION_REQUEST_STATUSES,
  REQUIRED_FIELD_PHOTO_TYPES,
} from '../utils/verification.constants';
import { AdminNotificationEvent } from '../../types/admin-notification.types';
import { FcmEventType } from '../../types/fcm.types';

@Injectable()
export class AdminVerificationService {
  private readonly logger = new Logger(AdminVerificationService.name);
  private readonly bufferDurationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verificationQueue: VerificationQueueService,
    private readonly firebaseService: AdminFirebaseService,
  ) {
    this.bufferDurationMinutes = this.configService.get<number>('ADMIN_BUFFER_DURATION_MINUTES', 60);
  }

  async listDrivers(filters: ListVerificationDriversRequestDto) {
    const {
      search,
      driverVerificationStatus,
      requestStatus,
      verificationType,
      hasActiveRequest,
      isAssigned,
      hasPendingDocuments,
      assignedToId,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.DriverWhereInput = {
      firstName: { not: null },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    if (driverVerificationStatus) {
      where.verificationStatus = driverVerificationStatus;
    }

    if (hasPendingDocuments !== undefined) {
      where.documents = hasPendingDocuments
        ? {
            OR: [
              { licenseStatus: VerificationStatus.PENDING },
              { rcBookStatus: VerificationStatus.PENDING },
              { fcStatus: VerificationStatus.PENDING },
              { insuranceStatus: VerificationStatus.PENDING },
            ],
          }
        : {
            NOT: {
              OR: [
                { licenseStatus: VerificationStatus.PENDING },
                { rcBookStatus: VerificationStatus.PENDING },
                { fcStatus: VerificationStatus.PENDING },
                { insuranceStatus: VerificationStatus.PENDING },
              ],
            },
          };
    }

    const drivers = await this.prisma.driver.findMany({
      where,
      include: this.driverInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    const filteredDrivers = drivers.filter((driver) => {
      const latestRequest = driver.verificationRequests?.[0] ?? null;

      if (requestStatus && latestRequest?.status !== requestStatus) {
        return false;
      }

      if (verificationType && latestRequest?.verificationType !== verificationType) {
        return false;
      }

      if (assignedToId && latestRequest?.assignedToId !== assignedToId) {
        return false;
      }

      if (isAssigned !== undefined) {
        const assigned = !!latestRequest?.assignedToId;
        if (assigned !== isAssigned) {
          return false;
        }
      }

      if (hasActiveRequest !== undefined) {
        const active = !!latestRequest && ACTIVE_VERIFICATION_REQUEST_STATUSES.includes(latestRequest.status);
        if (active !== hasActiveRequest) {
          return false;
        }
      }

      return true;
    });

    const total = filteredDrivers.length;
    const paginatedDrivers = filteredDrivers.slice((page - 1) * limit, page * limit);

    return {
      drivers: paginatedDrivers as any,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDriverForVerification(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: this.driverInclude(),
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const currentVerification = driver.verificationRequests[0] ?? null;
    const latestFieldPhotos = await this.getLatestFieldPhotosForDriver(driverId);

    return this.toVerificationDetail(driver, currentVerification, latestFieldPhotos);
  }

  async createVerificationRequest(dto: CreateVerificationRequestDto) {
    return this.ensureVerificationRequestExists(dto.driverId);
  }

  async assignVerification(id: string, dto: AssignVerificationRequestDto, assignedById: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: true,
        assignedTo: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    // Prevent assigning/reassigning when the latest request is not active
    // (i.e. rejected or final approved).
    if (!ACTIVE_VERIFICATION_REQUEST_STATUSES.includes(verification.status)) {
      throw new BadRequestException('Cannot assign verification request unless it is active');
    }

    const assignee = await this.prisma.adminUser.findUnique({
      where: {
        email: dto.email.trim().toLowerCase(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
        isActive: true,
      },
    });

    if (!assignee) {
      throw new NotFoundException('No admin user found with that email');
    }

    if (!assignee.isActive) {
      throw new BadRequestException('Cannot assign verification to an inactive user');
    }

    if (
      assignee.role !== AdminRole.ADMIN &&
      assignee.role !== AdminRole.AGENT &&
      assignee.role !== AdminRole.FIELD_AGENT &&
      assignee.role !== AdminRole.SUPER_ADMIN
    ) {
      throw new BadRequestException('User is not eligible to receive verification assignments');
    }

    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      assignedToId: verification.assignedToId,
    };

    const updated = await this.prisma.driverVerificationRequest.update({
      where: { id },
      data: {
        assignedToId: assignee.id,
        status:
          verification.status === VerificationRequestStatus.PENDING
            ? VerificationRequestStatus.IN_REVIEW
            : verification.status,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          },
        },
      },
    });

    await this.prisma.adminNotification.create({
      data: {
        userId: assignee.id,
        title: 'New verification assigned',
        message: `You have been assigned a verification request for ${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
        entityId: updated.id,
        entityType: 'VERIFICATION',
        driverId: verification.driver.id,
        actionUrl: `/dashboard/verifications/request/${updated.id}`,
      },
    });

    if (updated.assignedTo) {
      this.firebaseService
        .notifyAdminSessions(updated.assignedTo.id, {
          notification: {
            title: 'New Verification Assigned',
            body: `You have been assigned verification for driver ${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
          },
          data: {
            event: AdminNotificationEvent.VERIFICATION_ASSIGNED,
            entityId: updated.id,
            entityType: 'VERIFICATION',
            driverId: verification.driver.id,
            actionUrl: `/dashboard/verifications/request/${updated.id}`,
          },
        })
        .catch((error) => {
          this.logger.error(`Failed to notify admin user ${updated.assignedTo!.id}`, error);
        });
    }

    return {
      ...updated,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot: {
          verificationId: updated.id,
          status: updated.status,
          assignedToId: updated.assignedToId,
          assignedToEmail: updated.assignedTo?.email ?? null,
        },
        entityId: updated.id,
      },
    };
  }

  async rejectDriver(id: string, reason: string, rejectedById: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    if (!reason || reason.length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }

    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      driverVerificationStatus: verification.driver.verificationStatus,
    };

    const [updated] = await this.prisma.$transaction([
      this.prisma.driverVerificationRequest.update({
        where: { id },
        data: {
          status: VerificationRequestStatus.REJECTED,
          revertReason: reason,
          bufferExpiresAt: null,
        },
      }),
      this.prisma.verificationAction.create({
        data: {
          verificationRequestId: id,
          actionType: 'REJECTED',
          reason,
          actionById: rejectedById,
        },
      }),
      this.prisma.driver.update({
        where: { id: verification.driver.id },
        data: { verificationStatus: VerificationStatus.REJECTED },
      }),
    ]);

    await this.verificationQueue.cancelVerificationFinalization(id);

    this.firebaseService
      .notifyAllSessions(
        verification.driver.id,
        'driver',
        {
          notification: {
            title: 'Verification Rejected',
            body: `Your verification was rejected: ${reason}`,
          },
          data: {
            event: FcmEventType.DriverVerificationUpdate,
            status: 'REJECTED',
            reason,
          },
        },
        this.prisma,
      )
      .catch((error) => {
        this.logger.error(`Failed to notify driver ${verification.driver.id} about rejection`, error);
      });

    return {
      ...updated,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot: {
          verificationId: id,
          status: updated.status,
          driverVerificationStatus: VerificationStatus.REJECTED,
        },
        entityId: id,
      },
    };
  }

  async revertRejectedDriver(driverId: string, _actionById: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.verificationStatus !== VerificationStatus.REJECTED) {
      throw new BadRequestException('Driver is not currently rejected');
    }

    const beforeSnapshot = {
      driverId,
      driverVerificationStatus: driver.verificationStatus,
    };

    await this.prisma.driver.update({
      where: { id: driverId },
      data: { verificationStatus: VerificationStatus.PENDING },
    });

    const ensured = await this.ensureVerificationRequestExists(driverId);

    return {
      ...ensured,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot: {
          driverId,
          driverVerificationStatus: VerificationStatus.PENDING,
          requestCreated: ensured.created,
          ensuredRequestId: ensured.request?.id ?? null,
        },
        entityId: driverId,
      },
    };
  }

  async handleRevertDecision(
    id: string,
    dto: RevertDecisionRequestDto,
    handledById: string,
    handlerRole: AdminRole,
  ) {
    if (handlerRole !== AdminRole.ADMIN && handlerRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can handle revert decisions');
    }

    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: {
          include: { documents: true },
        },
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    if (verification.status !== VerificationRequestStatus.REVERT_REQUESTED) {
      throw new BadRequestException('Verification is not pending revert approval');
    }

    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      bufferExpiresAt: verification.bufferExpiresAt,
      revertReason: verification.revertReason,
    };

    if (dto.approve) {
      await this.prisma.$transaction([
        this.prisma.driverVerificationRequest.update({
          where: { id },
          data: {
            status: VerificationRequestStatus.REVERTED,
            bufferExpiresAt: null,
            approvedAt: null,
            approvedById: null,
            revertReason: null,
            revertRequestedById: null,
            revertRequestedAt: null,
          },
        }),
        this.prisma.verificationAction.create({
          data: {
            verificationRequestId: id,
            actionType: 'REVERT_APPROVED',
            actionById: handledById,
          },
        }),
        this.prisma.driver.update({
          where: { id: verification.driver.id },
          data: { verificationStatus: VerificationStatus.PENDING },
        }),
        ...(verification.driver.documents
          ? [
              this.prisma.driverDocuments.update({
                where: { id: verification.driver.documents.id },
                data: {
                  licenseStatus: VerificationStatus.PENDING,
                  rcBookStatus: VerificationStatus.PENDING,
                  fcStatus: VerificationStatus.PENDING,
                  insuranceStatus: VerificationStatus.PENDING,
                },
              }),
            ]
          : []),
      ]);

      await this.verificationQueue.cancelVerificationFinalization(id);

      return {
        success: true,
        message: 'Revert approved - verification reset to pending',
        [AUDIT_METADATA_KEY]: {
          beforeSnapshot,
          afterSnapshot: {
            verificationId: id,
            status: VerificationRequestStatus.REVERTED,
            bufferExpiresAt: null,
          },
          entityId: id,
        },
      };
    }

    const bufferExpiresAt = new Date(Date.now() + this.bufferDurationMinutes * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.driverVerificationRequest.update({
        where: { id },
        data: {
          status: VerificationRequestStatus.APPROVED,
          revertReason: null,
          revertRequestedById: null,
          revertRequestedAt: null,
          bufferExpiresAt,
        },
      }),
      this.prisma.verificationAction.create({
        data: {
          verificationRequestId: id,
          actionType: 'REVERT_REJECTED',
          actionById: handledById,
        },
      }),
    ]);

    await this.verificationQueue.scheduleVerificationFinalization(id, bufferExpiresAt);

    return {
      success: true,
      message: 'Revert rejected - verification remains approved and timer restarted',
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot: {
          verificationId: id,
          status: VerificationRequestStatus.APPROVED,
          bufferExpiresAt,
        },
        entityId: id,
      },
    };
  }

  async finalizeVerificationById(verificationId: string): Promise<void> {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: {
        driver: {
          include: { documents: true },
        },
      },
    });

    if (!verification) {
      throw new NotFoundException(`Verification ${verificationId} not found`);
    }

    if (
      verification.status !== VerificationRequestStatus.APPROVED ||
      !verification.bufferExpiresAt ||
      verification.bufferExpiresAt > new Date()
    ) {
      this.logger.log(
        `Skipping finalization for ${verificationId}; status=${verification.status}, bufferExpiresAt=${verification.bufferExpiresAt?.toISOString() ?? 'null'}`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.driverVerificationRequest.update({
        where: { id: verificationId },
        data: {
          status: VerificationRequestStatus.FINAL_APPROVED,
          bufferExpiresAt: null,
          revertReason: null,
          revertRequestedById: null,
          revertRequestedAt: null,
        },
      });

      await tx.driver.update({
        where: { id: verification.driver.id },
        data: { verificationStatus: VerificationStatus.VERIFIED },
      });

      if (verification.driver.documents) {
        await tx.driverDocuments.update({
          where: { id: verification.driver.documents.id },
          data: {
            licenseStatus: VerificationStatus.VERIFIED,
            rcBookStatus: VerificationStatus.VERIFIED,
            fcStatus: VerificationStatus.VERIFIED,
            insuranceStatus: VerificationStatus.VERIFIED,
          },
        });
      }
    });

    this.firebaseService
      .notifyAllSessions(
        verification.driver.id,
        'driver',
        {
          notification: {
            title: 'Verification Complete!',
            body: 'You can now accept rides.',
          },
          data: {
            event: FcmEventType.DriverVerificationUpdate,
            status: 'FINAL_APPROVED',
          },
        },
        this.prisma,
      )
      .catch((error) => {
        this.logger.error(`Failed to notify driver ${verification.driver.id} about finalization`, error);
      });
  }

  private async ensureVerificationRequestExists(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        documents: true,
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const existing = driver.verificationRequests[0] ?? null;
    if (existing && ACTIVE_VERIFICATION_REQUEST_STATUSES.includes(existing.status)) {
      return {
        created: false,
        message: 'Active verification request already exists',
        request: existing,
      };
    }

    const hasPendingDocuments = !!driver.documents && [
      driver.documents.licenseStatus,
      driver.documents.rcBookStatus,
      driver.documents.fcStatus,
      driver.documents.insuranceStatus,
    ].some((status) => status === VerificationStatus.PENDING);

    const isEligible =
      driver.verificationStatus === VerificationStatus.PENDING || hasPendingDocuments;

    if (!isEligible) {
      throw new BadRequestException('Driver is not eligible for a new verification request');
    }

    const verificationType =
      driver.verificationStatus === VerificationStatus.VERIFIED
        ? DriverVerificationType.EXISTING_DRIVER
        : DriverVerificationType.NEW_DRIVER;

    const request = await this.prisma.driverVerificationRequest.create({
      data: {
        driverId,
        verificationType,
        status: VerificationRequestStatus.PENDING,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          },
        },
      },
    });

    return {
      created: true,
      message: 'Verification request created successfully',
      request,
    };
  }

  private async getLatestFieldPhotosForDriver(driverId: string) {
    const photos = await this.prisma.fieldVerificationPhoto.findMany({
      where: {
        verificationRequest: {
          driverId,
        },
      },
      include: {
        verificationRequest: {
          select: {
            id: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    const latestByType = new Map<FieldPhotoType, (typeof photos)[number]>();
    for (const photo of photos) {
      if (!latestByType.has(photo.photoType)) {
        latestByType.set(photo.photoType, photo);
      }
    }

    return Array.from(latestByType.values()).map((photo) => ({
      ...photo,
      verificationRequestId: photo.verificationRequest.id,
    }));
  }

  private driverInclude(): Prisma.DriverInclude {
    return {
      documents: true,
      vehicle: {
        include: {
          owner: true,
        },
      },
      address: true,
      verificationRequests: {
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
          revertRequestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
          fieldPhotos: true,
          documentActions: {
            orderBy: { actionAt: 'desc' },
            include: {
              actionBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
          verificationActions: {
            orderBy: { actionAt: 'desc' },
            include: {
              actionBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private toVerificationDetail(
    driver: any,
    currentVerification: any,
    latestFieldPhotos: any[],
  ) {
    const editableStatuses: VerificationRequestStatus[] = [
      VerificationRequestStatus.PENDING,
      VerificationRequestStatus.IN_REVIEW,
      VerificationRequestStatus.REVERTED,
    ];

    const hasActiveRequest =
      !!currentVerification && ACTIVE_VERIFICATION_REQUEST_STATUSES.includes(currentVerification.status);

    const hasPendingDocuments = !!driver.documents && [
      driver.documents.licenseStatus,
      driver.documents.rcBookStatus,
      driver.documents.fcStatus,
      driver.documents.insuranceStatus,
    ].some((status) => status === VerificationStatus.PENDING);

    const hasAllRequiredDocumentsVerified = !!driver.documents && [
      driver.documents.licenseStatus,
      driver.documents.rcBookStatus,
      driver.documents.fcStatus,
      driver.documents.insuranceStatus,
    ].every((status) => status === VerificationStatus.VERIFIED);

    const hasAllRequiredFieldPhotos = REQUIRED_FIELD_PHOTO_TYPES.every((type) =>
      latestFieldPhotos.some((photo) => photo.photoType === type),
    );

    return {
      ...driver,
      currentVerification: currentVerification
        ? {
            ...currentVerification,
            fieldPhotos: latestFieldPhotos,
          }
        : null,
      eligibility: {
        hasActiveRequest,
        canCreateRequest:
          !hasActiveRequest &&
          driver.verificationStatus !== VerificationStatus.REJECTED &&
          (driver.verificationStatus === VerificationStatus.PENDING || hasPendingDocuments),
        hasAllRequiredFieldPhotos,
          canVerify:
            !!currentVerification &&
            hasAllRequiredDocumentsVerified &&
            hasAllRequiredFieldPhotos &&
            editableStatuses.includes(currentVerification.status),
        canRejectDriver:
          !!currentVerification &&
          currentVerification.status !== VerificationRequestStatus.REJECTED,
        canRevertRejectedDriver: driver.verificationStatus === VerificationStatus.REJECTED,
        canUploadFieldPhotos:
          !!currentVerification && editableStatuses.includes(currentVerification.status),
      },
    };
  }
}
