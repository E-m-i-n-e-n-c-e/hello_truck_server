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
import { AdminNotificationsService } from '../../notifications/admin-notifications.service';
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
import { LibredeskService } from '../../libredesk/libredesk.service';
import { AuditActionTypes } from 'src/admin-portal/audit-log/audit-log.service';

@Injectable()
export class AdminVerificationService {
  private readonly logger = new Logger(AdminVerificationService.name);
  private readonly bufferDurationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verificationQueue: VerificationQueueService,
    private readonly firebaseService: AdminFirebaseService,
    private readonly libredeskService: LibredeskService,
    private readonly notificationsService: AdminNotificationsService,
  ) {
    // TODO:
    // this.bufferDurationMinutes = this.configService.get<number>('ADMIN_BUFFER_DURATION_MINUTES', 60);
    this.bufferDurationMinutes = 1;
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

    const offset = (page - 1) * limit;
    const conditions: Prisma.Sql[] = [Prisma.sql`d."firstName" IS NOT NULL`];

    // Search filter
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(Prisma.sql`(
        (d."firstName" || ' ' || d."lastName") ILIKE ${searchPattern} OR
        d."firstName" ILIKE ${searchPattern} OR
        d."lastName" ILIKE ${searchPattern} OR
        d."phoneNumber" LIKE ${searchPattern}
      )`);
    }

    // Driver verification status
    if (driverVerificationStatus) {
      conditions.push(Prisma.sql`d."verificationStatus" = ${driverVerificationStatus}::"VerificationStatus"`);
    }

    // Pending documents filter
    if (hasPendingDocuments !== undefined) {
      if (hasPendingDocuments) {
        conditions.push(Prisma.sql`(
          doc."licenseStatus" = 'PENDING'::"VerificationStatus" OR
          doc."rcBookStatus" = 'PENDING'::"VerificationStatus" OR
          doc."fcStatus" = 'PENDING'::"VerificationStatus" OR
          doc."insuranceStatus" = 'PENDING'::"VerificationStatus"
        )`);
      } else {
        conditions.push(Prisma.sql`(
          doc."licenseStatus" != 'PENDING'::"VerificationStatus" AND
          doc."rcBookStatus" != 'PENDING'::"VerificationStatus" AND
          doc."fcStatus" != 'PENDING'::"VerificationStatus" AND
          doc."insuranceStatus" != 'PENDING'::"VerificationStatus"
        )`);
      }
    }

    // Latest request filters
    if (requestStatus) {
      conditions.push(Prisma.sql`latest_vr.status = ${requestStatus}::"VerificationRequestStatus"`);
    }

    if (verificationType) {
      conditions.push(Prisma.sql`latest_vr."verificationType" = ${verificationType}::"DriverVerificationType"`);
    }

    if (hasActiveRequest !== undefined) {
      if (hasActiveRequest) {
        conditions.push(Prisma.sql`latest_vr.status = ANY(${ACTIVE_VERIFICATION_REQUEST_STATUSES}::"VerificationRequestStatus"[])`);
      } else {
        conditions.push(Prisma.sql`(latest_vr.status IS NULL OR latest_vr.status != ALL(${ACTIVE_VERIFICATION_REQUEST_STATUSES}::"VerificationRequestStatus"[]))`);
      }
    }

    if (isAssigned !== undefined) {
      if (isAssigned) {
        conditions.push(Prisma.sql`latest_vr."assignedToId" IS NOT NULL`);
      } else {
        conditions.push(Prisma.sql`(latest_vr."assignedToId" IS NULL OR latest_vr.id IS NULL)`);
      }
    }

    if (assignedToId) {
      conditions.push(Prisma.sql`latest_vr."assignedToId" = ${assignedToId}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ` AND `)}`
        : Prisma.empty;

    // Query to get driver IDs with filters applied on LATEST request only
    const query = Prisma.sql`
      WITH driver_data AS (
        SELECT
          d.id,
          COUNT(*) OVER() as total_count
        FROM "Driver" d
        LEFT JOIN "DriverDocuments" doc ON doc."driverId" = d.id
        LEFT JOIN LATERAL (
          SELECT *
          FROM "DriverVerificationRequest" vr
          WHERE vr."driverId" = d.id
          ORDER BY vr."createdAt" DESC
          LIMIT 1
        ) latest_vr ON true
        ${whereClause}
        ORDER BY COALESCE(latest_vr."createdAt", d."profileCreatedAt", d."createdAt") DESC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT * FROM driver_data
    `;

    const result = await this.prisma.$queryRaw<Array<{ id: string; total_count: bigint }>>(query);

    const total = result.length > 0 ? Number(result[0].total_count) : 0;
    const driverIds = result.map((r) => r.id);

    if (driverIds.length === 0) {
      return {
        drivers: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Fetch full driver data with relations using Prisma
    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: driverIds } },
      include: this.driverInclude(),
    });

    // Sort to match the order from the query
    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const sortedDrivers = driverIds.map((id) => driverMap.get(id)!).filter(Boolean);

    return {
      drivers: sortedDrivers as any,
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

    // Prevent reassigning to same user
    if (verification.assignedToId && dto.email.trim().toLowerCase() === verification.assignedTo?.email?.toLowerCase()) {
      throw new BadRequestException('Verification is already assigned to this user');
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
      assignedToEmail: verification.assignedTo?.email,
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

    if (updated.assignedTo) {
      if (updated.ticketId) {
        this.libredeskService.assignConversation(updated.ticketId, assignee.email);
      }

      // Send notification (fire-and-forget, best effort)
      this.notificationsService.sendNotification(
        {
          title: 'New verification assigned',
          message: `You have been assigned a verification request for ${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
          entityId: updated.id,
          entityType: 'VERIFICATION',
          driverId: verification.driver.id,
          actionUrl: `/verifications/request/${updated.id}`,
        },
        {
          userId: assignee.id,
          event: AdminNotificationEvent.VERIFICATION_ASSIGNED,
        },
      ).catch((error) => {
        this.logger.error(`Failed to send assignment notification to ${assignee.id}:`, error);
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
        revertRequestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
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
            actionType: AuditActionTypes.REVERT_APPROVED,
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

      // Notify the agent who requested the revert
      if (verification.revertRequestedBy?.id) {
        this.notificationsService
          .sendNotification(
            {
              title: 'Verification revert approved',
              message: `Verification revert approved for driver ${verification.driver.firstName || verification.driver.phoneNumber}`,
              entityId: id,
              entityType: 'VERIFICATION',
              driverId: verification.driver.id,
              actionUrl: `/verifications/request/${id}`,
            },
            {
              userId: verification.revertRequestedBy.id,
              event: AdminNotificationEvent.VERIFICATION_REVERT_DECISION,
            },
          )
          .catch((error) => {
            this.logger.error(`Failed to notify revert requester ${verification.revertRequestedBy?.id}`, error);
          });
      }

      return {
        success: true,
        message: 'Revert approved - verification reset to pending',
        [AUDIT_METADATA_KEY]: {
          actionType: AuditActionTypes.REVERT_APPROVED,
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
          actionType: AuditActionTypes.REVERT_REJECTED,
          actionById: handledById,
        },
      }),
    ]);

    await this.verificationQueue.scheduleVerificationFinalization(id, bufferExpiresAt);

    // Notify the agent who requested the revert that it was rejected
    if (verification.revertRequestedBy?.id) {
      this.notificationsService
        .sendNotification(
          {
            title: 'Verification revert rejected',
            message: `Verification remains approved for driver ${verification.driver.firstName || verification.driver.phoneNumber}`,
            entityId: id,
            entityType: 'VERIFICATION',
            driverId: verification.driver.id,
            actionUrl: `/verifications/request/${id}`,
          },
          {
            userId: verification.revertRequestedBy.id,
            event: AdminNotificationEvent.VERIFICATION_REVERT_DECISION,
          },
        )
        .catch((error) => {
          this.logger.error(`Failed to notify revert requester ${verification.revertRequestedBy?.id}`, error);
        });
    }

    return {
      success: true,
      message: 'Revert rejected - verification remains approved and timer restarted',
      [AUDIT_METADATA_KEY]: {
        actionType: AuditActionTypes.REVERT_REJECTED,
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
