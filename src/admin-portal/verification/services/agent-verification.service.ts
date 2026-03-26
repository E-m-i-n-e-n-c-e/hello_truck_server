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
  DocumentActionType,
  FieldPhotoType,
  Prisma,
  VerificationRequestStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DocumentActionRequestDto,
  ListVerificationsRequestDto,
  RevertDocumentRejectionRequestDto,
  VerificationRevertRequestDto,
} from '../dto/verification-request.dto';
import { FieldVerificationService } from './field-verification.service';
import { VerificationQueueService } from './verification-queue.service';
import { AdminFirebaseService } from '../../firebase/admin-firebase.service';
import { AdminNotificationsService } from '../../notifications/admin-notifications.service';
import { FcmEventType } from '../../types/fcm.types';
import { AUDIT_METADATA_KEY } from '../../audit-log/decorators/audit-log.decorator';
import { AuditActionTypes } from '../../audit-log/audit-log.service';
import {
  ACTIVE_VERIFICATION_REQUEST_STATUSES,
  DOCUMENT_FIELDS,
  DocumentField,
  REQUIRED_FIELD_PHOTO_TYPES,
} from '../utils/verification.constants';

const DOCUMENT_STATUS_MAP: Record<DocumentField, string | null> = {
  license: 'licenseStatus',
  rcBook: 'rcBookStatus',
  fc: 'fcStatus',
  insurance: 'insuranceStatus',
  aadhar: null,
  selfie: null,
};

@Injectable()
export class AgentVerificationService {
  private readonly logger = new Logger(AgentVerificationService.name);
  private readonly bufferDurationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verificationQueue: VerificationQueueService,
    private readonly firebaseService: AdminFirebaseService,
    private readonly fieldVerificationService: FieldVerificationService,
    private readonly notificationsService: AdminNotificationsService,
  ) {
    // TODO:
    // this.bufferDurationMinutes = this.configService.get<number>('ADMIN_BUFFER_DURATION_MINUTES', 60);
    this.bufferDurationMinutes = 1;
  }

  async listRequests(filters: ListVerificationsRequestDto, userId?: string, userRole?: AdminRole) {
    const {
      status,
      verificationType,
      assignedToId,
      driverId,
      startDate,
      endDate,
      search,
      driverVerificationStatus,
      hasActiveRequest,
      isAssigned,
      hasPendingDocuments,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.DriverVerificationRequestWhereInput = {};

    if (status) where.status = status;
    if (verificationType) where.verificationType = verificationType;
    if (driverId) where.driverId = driverId;

    const effectiveAssignedToId =
      userRole === AdminRole.AGENT || userRole === AdminRole.FIELD_AGENT ? userId : assignedToId;
    if (effectiveAssignedToId) {
      where.assignedToId = effectiveAssignedToId;
    }

    if (isAssigned !== undefined && !effectiveAssignedToId) {
      where.assignedToId = isAssigned ? { not: null } : null;
    }

    if (hasActiveRequest !== undefined && !status) {
      where.status = hasActiveRequest
        ? { in: ACTIVE_VERIFICATION_REQUEST_STATUSES }
        : { notIn: ACTIVE_VERIFICATION_REQUEST_STATUSES };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search || driverVerificationStatus || hasPendingDocuments !== undefined) {
      where.driver = {};
      if (search) {
        where.driver.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
        ];
      }
      if (driverVerificationStatus) {
        where.driver.verificationStatus = driverVerificationStatus;
      }
      if (hasPendingDocuments !== undefined) {
        where.driver.documents = hasPendingDocuments
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
    }

    const [verifications, total] = await Promise.all([
      this.prisma.driverVerificationRequest.findMany({
        where,
        include: {
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              verificationStatus: true,
            },
          },
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
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driverVerificationRequest.count({ where }),
    ]);

    return {
      verifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVerificationByRequest(requestId: string, userId?: string, userRole?: AdminRole) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: {
          include: this.driverInclude(),
        },
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
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    if (
      userRole &&
      (userRole === AdminRole.AGENT || userRole === AdminRole.FIELD_AGENT) &&
      verification.assignedToId !== userId
    ) {
      throw new ForbiddenException('You can only view verification requests assigned to you');
    }

    const latestFieldPhotos = await this.getLatestFieldPhotosForDriver(verification.driverId);
    return this.toVerificationDetail(verification.driver, verification, latestFieldPhotos, userId, userRole);
  }

  async documentAction(
    verificationId: string,
    field: DocumentField,
    dto: DocumentActionRequestDto,
    userId: string,
    userRole?: AdminRole,
  ) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: { driver: { include: { documents: true } } },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    await this.assertCanMutateDocuments(verification, userId, userRole);

    if (!verification.driver.documents) {
      throw new BadRequestException('Driver has no documents uploaded');
    }

    if (!DOCUMENT_FIELDS.includes(field)) {
      throw new BadRequestException(`Invalid document field: ${field}`);
    }

    if (dto.action === DocumentActionType.REJECTED && (!dto.rejectionReason || dto.rejectionReason.length < 10)) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }

    const statusField = DOCUMENT_STATUS_MAP[field];
    const beforeSnapshot = {
      verificationId,
      documentField: field,
      documentStatus: statusField ? (verification.driver.documents as any)[statusField] : null,
      verificationStatus: verification.status,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationDocumentAction.create({
        data: {
          verificationRequestId: verificationId,
          documentField: field,
          action: dto.action,
          rejectionReason: dto.rejectionReason,
          actionById: userId,
        },
      });

      if (statusField) {
        const updateData: Record<string, any> = {
          [statusField]:
            dto.action === DocumentActionType.APPROVED
              ? VerificationStatus.VERIFIED
              : VerificationStatus.REJECTED,
        };

        if (dto.action === DocumentActionType.APPROVED && dto.expiryDate) {
          updateData[`${field}Expiry`] = new Date(dto.expiryDate);
        }

        await tx.driverDocuments.update({
          where: { id: verification.driver.documents!.id },
          data: updateData,
        });
      }
    });

    if (dto.action === DocumentActionType.REJECTED) {
      this.firebaseService
        .notifyAllSessions(
          verification.driver.id,
          'driver',
          {
            notification: {
              title: 'Document Rejected',
              body: `Your ${field} was rejected: ${dto.rejectionReason}. Please re-upload.`,
            },
            data: {
              event: FcmEventType.DriverVerificationUpdate,
              documentField: field,
              status: 'REJECTED',
              reason: dto.rejectionReason || '',
            },
          },
          this.prisma,
        )
        .catch((error) => {
          this.logger.error(`Failed to notify driver ${verification.driver.id} about document rejection`, error);
        });
    }
    if (dto.action === DocumentActionType.APPROVED) {
      this.firebaseService
        .notifyAllSessions(
          verification.driver.id,
          'driver',
          {
            data: {
              event: FcmEventType.DriverVerificationUpdate,
              documentField: field,
              status: 'APPROVED',
            },
          },
          this.prisma,
        )
        .catch((error) => {
          this.logger.error(`Failed to notify driver ${verification.driver.id} about document approval`, error);
        });
    }

    return {
      success: true,
      message: `Document ${dto.action.toLowerCase()}`,
      [AUDIT_METADATA_KEY]: {
        actionType:
          dto.action === DocumentActionType.APPROVED
            ? AuditActionTypes.DOCUMENT_APPROVED
            : AuditActionTypes.DOCUMENT_REJECTED,
        beforeSnapshot,
        afterSnapshot: {
          verificationId,
          documentField: field,
          action: dto.action,
          rejectionReason: dto.rejectionReason,
        },
        entityId: verificationId,
      },
    };
  }

  async revertDocumentDecision(
    verificationId: string,
    field: DocumentField,
    _dto: RevertDocumentRejectionRequestDto,
    userId: string,
    userRole?: AdminRole,
  ) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: { driver: { include: { documents: true } } },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    await this.assertCanMutateDocuments(verification, userId, userRole);

    const statusField = DOCUMENT_STATUS_MAP[field];
    if (!statusField || !verification.driver.documents) {
      throw new BadRequestException('This document cannot be reverted');
    }

    const currentStatus = (verification.driver.documents as any)[statusField] as VerificationStatus;
    if (currentStatus === VerificationStatus.PENDING) {
      throw new BadRequestException('Document is already pending review');
    }

    const beforeSnapshot = {
      verificationId,
      documentField: field,
      documentStatus: currentStatus,
    };

    const documents = verification.driver.documents;

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationDocumentAction.create({
        data: {
          verificationRequestId: verificationId,
          documentField: field,
          action: DocumentActionType.APPROVED,
          rejectionReason: `Document ${currentStatus === VerificationStatus.VERIFIED ? 'approval' : 'rejection'} reverted`,
          actionById: userId,
        },
      });

      await tx.driverDocuments.update({
        where: { id: documents.id },
        data: {
          [statusField]: VerificationStatus.PENDING,
        },
      });
    });

    return {
      success: true,
      message: 'Document review decision reverted',
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot: {
          verificationId,
          documentField: field,
          documentStatus: VerificationStatus.PENDING,
        },
        entityId: verificationId,
      },
    };
  }

  async approveVerification(id: string, userId: string) {
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

    const latestFieldPhotos = await this.getLatestFieldPhotosForDriver(verification.driverId);
    const hasAllRequiredFieldPhotos = REQUIRED_FIELD_PHOTO_TYPES.every((type) =>
      latestFieldPhotos.some((photo) => photo.photoType === type),
    );
    const hasAllRequiredDocumentsVerified = !!verification.driver.documents && [
      verification.driver.documents.licenseStatus,
      verification.driver.documents.rcBookStatus,
      verification.driver.documents.fcStatus,
      verification.driver.documents.insuranceStatus,
    ].every((status) => status === VerificationStatus.VERIFIED);

    if (!hasAllRequiredFieldPhotos) {
      throw new BadRequestException('All 6 field photos are required before approval');
    }

    if (!hasAllRequiredDocumentsVerified) {
      throw new BadRequestException('All required documents must be approved before driver approval');
    }

    const approvableStatuses: VerificationRequestStatus[] = [
      VerificationRequestStatus.PENDING,
      VerificationRequestStatus.IN_REVIEW,
      VerificationRequestStatus.REVERTED,
    ];

    if (!approvableStatuses.includes(verification.status)) {
      throw new BadRequestException('Verification cannot be approved in its current status');
    }

    const bufferExpiresAt = new Date(Date.now() + this.bufferDurationMinutes * 60 * 1000);

    const [updated] = await this.prisma.$transaction([
      this.prisma.driverVerificationRequest.update({
        where: { id },
        data: {
          status: VerificationRequestStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: userId,
          bufferExpiresAt,
          revertReason: null,
          revertRequestedById: null,
          revertRequestedAt: null,
        },
      }),
      this.prisma.verificationAction.create({
        data: {
          verificationRequestId: id,
          actionType: 'APPROVED',
          actionById: userId,
        },
      }),
    ]);

    await this.verificationQueue.scheduleVerificationFinalization(id, bufferExpiresAt);

    return {
      ...updated,
      bufferDurationMinutes: this.bufferDurationMinutes,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot: {
          verificationId: id,
          status: verification.status,
          bufferExpiresAt: verification.bufferExpiresAt,
        },
        afterSnapshot: {
          verificationId: id,
          status: updated.status,
          bufferExpiresAt,
        },
        entityId: id,
      },
    };
  }

  async rejectDriver(id: string, reason: string, rejectedById: string, rejectedByRole?: AdminRole) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    await this.assertCanRejectDriver(verification, rejectedById, rejectedByRole);

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

  async requestRevert(id: string, dto: VerificationRevertRequestDto, userId: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        revertRequestedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    if (verification.status !== VerificationRequestStatus.APPROVED) {
      throw new BadRequestException('Can only request revert for approved verifications');
    }

    if (!verification.bufferExpiresAt || verification.bufferExpiresAt <= new Date()) {
      throw new BadRequestException('Buffer window has expired, cannot request revert');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.driverVerificationRequest.update({
        where: { id },
        data: {
          status: VerificationRequestStatus.REVERT_REQUESTED,
          revertReason: dto.reason,
          revertRequestedById: userId,
          revertRequestedAt: new Date(),
          bufferExpiresAt: null,
        },
      }),
      this.prisma.verificationAction.create({
        data: {
          verificationRequestId: id,
          actionType: 'REVERT_REQUESTED',
          reason: dto.reason,
          actionById: userId,
        },
      }),
    ]);

    try {
      await this.verificationQueue.cancelVerificationFinalization(id);
    } catch (error) {
      this.logger.error(`Failed to cancel verification finalization job for ${id}`, error);
      throw error;
    }

    // Broadcast notification to all admins (fire-and-forget, best effort)
    const driverName = `${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim();
    this.notificationsService.sendNotification(
      {
        title: 'Revert Request',
        message: `Agent requested to revert verification for ${driverName}`,
        entityId: id,
        entityType: 'VERIFICATION',
        driverId: verification.driver.id,
        actionUrl: `/verifications/request/${id}`,
      },
      {
        roles: [AdminRole.ADMIN, AdminRole.SUPER_ADMIN],
        useTopic: true,
        topic: 'admin-revert-requests',
        event: 'REVERT_REQUESTED',
      },
    ).catch((error) => {
      this.logger.error(`Failed to broadcast revert request notification:`, error);
    });

    return {
      ...updated,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot: {
          verificationId: id,
          status: verification.status,
          bufferExpiresAt: verification.bufferExpiresAt,
        },
        afterSnapshot: {
          verificationId: id,
          status: updated.status,
          bufferExpiresAt: null,
        },
        entityId: id,
      },
    };
  }

  private async assertCanMutateDocuments(
    verification: {
      id: string;
      driverId: string;
      status: VerificationRequestStatus;
      assignedToId: string | null;
    },
    userId?: string,
    userRole?: AdminRole,
  ) {
    const editableStatuses: VerificationRequestStatus[] = [
      VerificationRequestStatus.PENDING,
      VerificationRequestStatus.IN_REVIEW,
      VerificationRequestStatus.REVERTED,
    ];

    if (!editableStatuses.includes(verification.status)) {
      throw new ForbiddenException('Documents can only be modified on an active editable verification request');
    }

    if (userRole !== AdminRole.AGENT && userRole !== AdminRole.FIELD_AGENT) {
      return;
    }

    if (!userId || verification.assignedToId !== userId) {
      throw new ForbiddenException('You can only modify documents for verification requests assigned to you');
    }

    const latestRequest = await this.prisma.driverVerificationRequest.findFirst({
      where: {
        driverId: verification.driverId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        assignedToId: true,
        status: true,
      },
    });

    if (!latestRequest || latestRequest.id !== verification.id) {
      throw new ForbiddenException('You can only modify documents for the driver\'s latest verification request');
    }

    if (latestRequest.assignedToId !== userId) {
      throw new ForbiddenException('You can only modify documents for verification requests assigned to you');
    }
  }

  private async assertCanRejectDriver(
    verification: {
      id: string;
      driverId: string;
      status: VerificationRequestStatus;
      assignedToId: string | null;
    },
    userId?: string,
    userRole?: AdminRole,
  ) {
    const latestRequest = await this.prisma.driverVerificationRequest.findFirst({
      where: {
        driverId: verification.driverId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        assignedToId: true,
        status: true,
      },
    });

    if (!latestRequest || latestRequest.id !== verification.id) {
      throw new ForbiddenException('You can only reject the driver on the latest verification request');
    }

    if (userRole !== AdminRole.AGENT && userRole !== AdminRole.FIELD_AGENT) {
      if (verification.status === VerificationRequestStatus.REJECTED) {
        throw new ForbiddenException('Driver is already rejected');
      }
      return;
    }

    const editableStatuses: VerificationRequestStatus[] = [
      VerificationRequestStatus.PENDING,
      VerificationRequestStatus.IN_REVIEW,
      VerificationRequestStatus.REVERTED,
    ];

    if (!editableStatuses.includes(verification.status)) {
      throw new ForbiddenException('Driver can only be rejected on an active editable verification request');
    }

    if (!userId || verification.assignedToId !== userId) {
      throw new ForbiddenException('You can only reject drivers for verification requests assigned to you');
    }

    if (latestRequest.assignedToId !== userId) {
      throw new ForbiddenException('You can only reject drivers for verification requests assigned to you');
    }
  }

  uploadPhotos(verificationId: string, dto: any, userId: string, role: AdminRole) {
    dto.verificationId = verificationId;
    return this.fieldVerificationService.uploadPhotos(dto, userId, role);
  }

  getSignedUploadUrl(
    verificationId: string,
    photoType: string,
    contentType: string,
    fileName: string,
    userId: string,
    role: AdminRole,
  ) {
    return this.fieldVerificationService.getSignedUploadUrl(
      verificationId,
      photoType,
      contentType,
      fileName,
      userId,
      role,
    );
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
    verification: any,
    latestFieldPhotos: any[],
    userId?: string,
    userRole?: AdminRole,
  ) {
    const editableStatuses: VerificationRequestStatus[] = [
      VerificationRequestStatus.PENDING,
      VerificationRequestStatus.IN_REVIEW,
      VerificationRequestStatus.REVERTED,
    ];

    const hasAllRequiredDocumentsVerified = !!driver.documents && [
      driver.documents.licenseStatus,
      driver.documents.rcBookStatus,
      driver.documents.fcStatus,
      driver.documents.insuranceStatus,
    ].every((status) => status === VerificationStatus.VERIFIED);

    const hasAllRequiredFieldPhotos = REQUIRED_FIELD_PHOTO_TYPES.every((type) =>
      latestFieldPhotos.some((photo) => photo.photoType === type),
    );

    const latestActiveRequest = (driver.verificationRequests ?? []).find((request: any) =>
      ACTIVE_VERIFICATION_REQUEST_STATUSES.includes(request.status),
    );
    const isLatestActiveRequest = !!latestActiveRequest && latestActiveRequest.id === verification.id;
    const isAgentRole = userRole === AdminRole.AGENT || userRole === AdminRole.FIELD_AGENT;
    const canRejectDriver = isAgentRole
      ? editableStatuses.includes(verification.status) &&
        !!userId &&
        verification.assignedToId === userId &&
        isLatestActiveRequest
      : isLatestActiveRequest &&
        verification.status !== VerificationRequestStatus.REJECTED;

    return {
      ...driver,
      currentVerification: {
        ...verification,
        fieldPhotos: latestFieldPhotos,
      },
      eligibility: {
        hasActiveRequest: ACTIVE_VERIFICATION_REQUEST_STATUSES.includes(verification.status),
        canCreateRequest: false,
        hasAllRequiredFieldPhotos,
        canVerify:
          hasAllRequiredDocumentsVerified &&
          hasAllRequiredFieldPhotos &&
          editableStatuses.includes(verification.status),
        canRejectDriver,
        canRevertRejectedDriver: false,
        canUploadFieldPhotos: editableStatuses.includes(verification.status),
      },
    };
  }
}
