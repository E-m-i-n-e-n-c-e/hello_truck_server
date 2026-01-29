/**
 * Verification Service
 *
 * Handles driver verification workflow:
 * - Create verification requests (new/existing drivers)
 * - Assign to agents
 * - Approve/reject documents
 * - Buffer window management
 * - Revert requests
 */
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DriverVerificationType,
  VerificationRequestStatus,
  DocumentActionType,
  AdminRole,
  VerificationStatus,
  Prisma,
} from '@prisma/client';
import {
  ListVerificationsRequestDto,
  DocumentActionRequestDto,
  AssignVerificationRequestDto,
  RevertRequestDto,
} from './dto/verification-request.dto';
import { ConfigService } from '@nestjs/config';
import { VerificationQueueService } from './verification-queue.service';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';
import { FcmEventType } from '../types/fcm.types';
import { AdminNotificationEvent } from '../types/admin-notification.types';
import { AUDIT_METADATA_KEY } from '../audit-log/decorators/audit-log.decorator';

// Document field names that match DriverDocuments columns
export const DOCUMENT_FIELDS = ['license', 'rcBook', 'fc', 'insurance', 'aadhar', 'selfie'] as const;
export type DocumentField = typeof DOCUMENT_FIELDS[number];

// Map document field to status field in DriverDocuments
const DOCUMENT_STATUS_MAP: Record<DocumentField, string> = {
  license: 'licenseStatus',
  rcBook: 'rcBookStatus',
  fc: 'fcStatus',
  insurance: 'insuranceStatus',
  aadhar: 'aadhar', // Aadhar doesn't have separate status
  selfie: 'selfie', // Selfie doesn't have separate status
};

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly bufferDurationMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verificationQueue: VerificationQueueService,
    private readonly firebaseService: AdminFirebaseService,
  ) {
    this.bufferDurationMinutes = this.configService.get<number>('ADMIN_BUFFER_DURATION_MINUTES', 60);
  }

  /**
   * Auto-create PENDING verification request if it doesn't exist
   * Used for automatic request creation on profile creation, document upload, and admin view
   */
  async ensureVerificationRequestExists(driverId: string): Promise<void> {
    try {
      // Single query: Find driver and include existing incomplete verification requests with status filter
      const driver = await this.prisma.driver.findUnique({
        where: { id: driverId },
        select: {
          verificationStatus: true,
          verificationRequests: {
            where: {
              status: {
                in: [
                  VerificationRequestStatus.PENDING,
                  VerificationRequestStatus.IN_REVIEW,
                  VerificationRequestStatus.APPROVED,
                  VerificationRequestStatus.REVERT_REQUESTED,
                  VerificationRequestStatus.REVERTED,
                ],
              },
            },
            select: { id: true },
            take: 1, // Only need to know if at least one exists
          },
        },
      });

      if (!driver) {
        this.logger.warn(`Driver ${driverId} not found, skipping verification request creation`);
        return;
      }

      // Check if existing request found (count > 0)
      if (driver.verificationRequests && driver.verificationRequests.length > 0) {
        // Request already exists, no need to create
        return;
      }

      // Determine verification type based on driver status
      const verificationType = driver.verificationStatus === VerificationStatus.VERIFIED
        ? DriverVerificationType.EXISTING_DRIVER
        : DriverVerificationType.NEW_DRIVER;

      // Create PENDING verification request
      await this.prisma.driverVerificationRequest.create({
        data: {
          driverId,
          verificationType,
          status: VerificationRequestStatus.PENDING,
        },
      });

      this.logger.log(`Auto-created PENDING verification request for driver ${driverId}`);
    } catch (error) {
      // Log error but don't throw - this is fire-and-forget
      this.logger.error(`Failed to auto-create verification request for driver ${driverId}`, error);
    }
  }

  /**
   * Auto-assign verification to agent with least workload (fire-and-forget)
   * NEW_DRIVER → FIELD_AGENT, EXISTING_DRIVER → AGENT
   * Runs asynchronously without blocking verification creation
   */
  private autoAssignVerificationAsync(verificationId: string, verificationType: DriverVerificationType): void {
    // Fire and forget - don't await
    this.tryAssignVerification(verificationId, verificationType)
      .catch(error => {
        this.logger.error(`Auto-assignment failed for verification ${verificationId}`, error);
        // Silently fail - cron job will pick it up later
      });
  }

  /**
   * Best-effort attempt to assign verification to agent
   * Used by both auto-assignment and cron job
   */
  async tryAssignVerification(verificationId: string, verificationType: DriverVerificationType): Promise<boolean> {
    try {
      // Determine target role based on verification type
      const targetRole = verificationType === DriverVerificationType.NEW_DRIVER
        ? AdminRole.FIELD_AGENT
        : AdminRole.AGENT;

      // Find all active users with target role
      const agents = await this.prisma.adminUser.findMany({
        where: {
          role: targetRole,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedVerifications: {
            where: {
              status: {
                in: [
                  VerificationRequestStatus.PENDING,
                  VerificationRequestStatus.IN_REVIEW,
                ],
              },
            },
            select: { id: true },
          },
        },
      });

      if (agents.length === 0) {
        this.logger.warn(`No active ${targetRole} found for auto-assignment`);
        return false;
      }

      // Find agent with least active assignments (load balancing)
      const agentWithLeastLoad = agents.reduce((min, agent) => {
        const currentLoad = agent.assignedVerifications.length;
        const minLoad = min.assignedVerifications.length;
        return currentLoad < minLoad ? agent : min;
      });

      // Update verification with assignment
      const verification = await this.prisma.driverVerificationRequest.update({
        where: { id: verificationId },
        data: {
          assignedToId: agentWithLeastLoad.id,
          status: VerificationRequestStatus.IN_REVIEW,
        },
        include: {
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      this.logger.log(
        `Assigned verification ${verificationId} to ${agentWithLeastLoad.firstName} ${agentWithLeastLoad.lastName} ` +
        `(${targetRole}) with ${agentWithLeastLoad.assignedVerifications.length} active assignments`
      );

      // Notify assigned agent (fire-and-forget)
      this.firebaseService.notifyAdminSessions(
        agentWithLeastLoad.id,
        {
          notification: {
            title: 'New Verification Assigned',
            body: `${verificationType === DriverVerificationType.NEW_DRIVER ? 'New driver' : 'Re-verification'} assigned: ${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`,
          },
          data: {
            event: AdminNotificationEvent.VERIFICATION_ASSIGNED,
            entityId: verification.id,
            entityType: 'VERIFICATION',
            driverId: verification.driver.id,
            actionUrl: `/verifications/driver/${verification.driver.id}`,
          },
        },
      ).catch(error => {
        this.logger.error(`Failed to notify agent ${agentWithLeastLoad.id}`, error);
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to assign verification ${verificationId}`, error);
      return false;
    }
  }

  /**
   * List drivers with PENDING verification status (NEW drivers)
   * Returns full driver details with documents, vehicle, address, and verification requests
   */
  async listPendingVerificationDrivers(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.DriverWhereInput = {
      verificationStatus: VerificationStatus.PENDING,
      firstName: { not: null },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take: limit,
        include: {
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
            },
          },
        },
        orderBy: { profileCreatedAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List drivers with VERIFIED status but PENDING documents (RE-VERIFICATION)
   * Returns full driver details with documents, vehicle, address, and verification requests
   */
  async listDriversWithPendingDocuments(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.DriverWhereInput = {
      verificationStatus: VerificationStatus.VERIFIED,
      firstName: { not: null },
      AND: [
        { firstName: { not: '' } },
      ],
      documents: {
        OR: [
          { licenseStatus: VerificationStatus.PENDING },
          { fcStatus: VerificationStatus.PENDING },
          { insuranceStatus: VerificationStatus.PENDING },
          { rcBookStatus: VerificationStatus.PENDING },
        ],
      },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take: limit,
        include: {
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
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return {
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List verification requests with filters
   */
  async listVerifications(filters: ListVerificationsRequestDto) {
    const {
      status,
      verificationType,
      assignedToId,
      driverId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.DriverVerificationRequestWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (verificationType) {
      where.verificationType = verificationType;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (driverId) {
      where.driverId = driverId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { driver: { firstName: { contains: search, mode: 'insensitive' } } },
        { driver: { lastName: { contains: search, mode: 'insensitive' } } },
        { driver: { phoneNumber: { contains: search } } },
        { ticketId: { contains: search, mode: 'insensitive' } },
      ];
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

  /**
   * Get driver details for verification (creates request if doesn't exist)
   * This is used by admin portal when viewing driver details
   * Agents/Field Agents can only view drivers with verifications assigned to them
   */
  async getDriverForVerification(driverId: string, userId?: string, userRole?: AdminRole) {
    // Ensure verification request exists (fallback if auto-creation failed)
    await this.ensureVerificationRequestExists(driverId);

    // Get driver with verification request
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: {
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
              },
            },
            approvedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
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
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Access control: Agents and Field Agents can only view drivers assigned to them
    if (userId && userRole && (userRole === AdminRole.AGENT || userRole === AdminRole.FIELD_AGENT)) {
      const latestVerification = driver.verificationRequests[0];
      if (!latestVerification || latestVerification.assignedToId !== userId) {
        throw new ForbiddenException('You can only view drivers with verifications assigned to you');
      }
    }

    return driver;
  }

  /**
   * Assign verification to an agent
   */
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

    // Capture before state
    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      assignedTo: verification.assignedTo ? {
        id: verification.assignedTo.id,
        name: `${verification.assignedTo.firstName} ${verification.assignedTo.lastName}`,
        email: verification.assignedTo.email,
        role: verification.assignedTo.role,
      } : null,
      driver: {
        id: verification.driver.id,
        name: `${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
        phoneNumber: verification.driver.phoneNumber,
      },
    };

    const updated = await this.prisma.driverVerificationRequest.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        status: VerificationRequestStatus.IN_REVIEW,
      },
      include: {
        assignedTo: true,
      },
    });

    // Capture after state
    const afterSnapshot = {
      verificationId: id,
      status: updated.status,
      assignedTo: updated.assignedTo ? {
        id: updated.assignedTo.id,
        name: `${updated.assignedTo.firstName} ${updated.assignedTo.lastName}`,
        email: updated.assignedTo.email,
        role: updated.assignedTo.role,
      } : null,
    };

    // Notify assigned agent (fire-and-forget)
    if (updated.assignedTo) {
      this.firebaseService.notifyAdminSessions(
        updated.assignedTo.id,
        {
          notification: {
            title: 'New Verification Assigned',
            body: `You have been assigned verification for driver ${verification.driver.firstName} ${verification.driver.lastName}`,
          },
          data: {
            event: AdminNotificationEvent.VERIFICATION_ASSIGNED,
            entityId: id,
            entityType: 'VERIFICATION',
            driverId: verification.driver.id,
            actionUrl: `/verifications/driver/${verification.driver.id}`,
          },
        },
      ).catch(error => {
        this.logger.error(`Failed to notify agent ${updated.assignedTo!.id} about assignment`, error);
      });
    }

    return {
      ...updated,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot,
        entityId: id,
      },
    };
  }

  /**
   * Approve or reject a document
   */
  async documentAction(
    verificationId: string,
    documentField: DocumentField,
    dto: DocumentActionRequestDto,
    actionById: string,
  ) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: { driver: { include: { documents: true } } },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    if (!verification.driver.documents) {
      throw new BadRequestException('Driver has no documents uploaded');
    }

    // Validate document field
    if (!DOCUMENT_FIELDS.includes(documentField)) {
      throw new BadRequestException(`Invalid document field: ${documentField}`);
    }

    // Validate rejection reason
    if (dto.action === DocumentActionType.REJECTED && (!dto.rejectionReason || dto.rejectionReason.length < 10)) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }

    // Capture before state
    const statusField = DOCUMENT_STATUS_MAP[documentField];
    const beforeSnapshot = {
      verificationId,
      documentField,
      driver: {
        id: verification.driver.id,
        name: `${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
        phoneNumber: verification.driver.phoneNumber,
      },
      documentStatus: statusField && statusField !== 'aadhar' && statusField !== 'selfie'
        ? verification.driver.documents[statusField]
        : 'N/A',
      verificationStatus: verification.status,
    };

    // Execute all database operations in a transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Create document action record
      await tx.verificationDocumentAction.create({
        data: {
          verificationRequestId: verificationId,
          documentField,
          action: dto.action,
          rejectionReason: dto.rejectionReason,
          actionById,
        },
      });

      // 2. Update the actual document status in DriverDocuments
      if (statusField && statusField !== 'aadhar' && statusField !== 'selfie') {
        const newStatus = dto.action === DocumentActionType.APPROVED
          ? VerificationStatus.VERIFIED
          : VerificationStatus.REJECTED;

        const updateData: any = { [statusField]: newStatus };

        // If approving and expiry date provided, update the expiry field
        if (dto.action === DocumentActionType.APPROVED && dto.expiryDate) {
          const expiryField = `${documentField}Expiry`;
          updateData[expiryField] = new Date(dto.expiryDate);
        }

        await tx.driverDocuments.update({
          where: { id: verification.driver.documents!.id },
          data: updateData,
        });
      }

      // 3. If rejected, update verification status
      if (dto.action === DocumentActionType.REJECTED) {
        await tx.driverVerificationRequest.update({
          where: { id: verificationId },
          data: { status: VerificationRequestStatus.REJECTED },
        });
      }
    });

    // Capture after state
    const afterSnapshot = {
      verificationId,
      documentField,
      action: dto.action,
      documentStatus: dto.action === DocumentActionType.APPROVED ? 'VERIFIED' : 'REJECTED',
      verificationStatus: dto.action === DocumentActionType.REJECTED ? 'REJECTED' : verification.status,
      rejectionReason: dto.rejectionReason,
      expiryDate: dto.expiryDate,
    };

    // Fire-and-forget: Notify driver about document rejection (outside transaction)
    if (dto.action === DocumentActionType.REJECTED) {
      this.firebaseService.notifyAllSessions(
        verification.driver.id,
        'driver',
        {
          notification: {
            title: 'Document Rejected',
            body: `Your ${documentField} was rejected: ${dto.rejectionReason}. Please re-upload.`,
          },
          data: {
            event: FcmEventType.DriverVerificationUpdate,
            documentField,
            status: 'REJECTED',
            reason: dto.rejectionReason || '',
          },
        },
        this.prisma,
      ).catch(error => {
        this.logger.error(`Failed to notify driver ${verification.driver.id} about document rejection`, error);
      });
    }

    return {
      success: true,
      message: `Document ${dto.action.toLowerCase()}`,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot,
        afterSnapshot,
        entityId: verificationId,
      },
    };
  }

  /**
   * Approve entire verification (starts buffer window)
   * NOTE: Driver and document statuses remain PENDING during buffer
   * Only after buffer expires (finalization) do they become VERIFIED
   */
  async approveVerification(id: string, approvedById: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            documents: true,
          },
        },
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    if (verification.status === VerificationRequestStatus.FINAL_APPROVED) {
      throw new BadRequestException('Verification already finalized');
    }

    // Capture before state
    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      driver: {
        id: verification.driver.id,
        name: `${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
        phoneNumber: verification.driver.phoneNumber,
        verificationStatus: verification.driver.verificationStatus,
      },
      documents: verification.driver.documents ? {
        licenseStatus: verification.driver.documents.licenseStatus,
        rcBookStatus: verification.driver.documents.rcBookStatus,
        fcStatus: verification.driver.documents.fcStatus,
        insuranceStatus: verification.driver.documents.insuranceStatus,
      } : null,
      bufferExpiresAt: verification.bufferExpiresAt,
    };

    // Calculate buffer expiry - exactly 60 minutes from now
    const bufferExpiresAt = new Date(Date.now() + this.bufferDurationMinutes * 60 * 1000);

    // Update verification status to APPROVED (starts buffer) and create action log
    const [updated] = await this.prisma.$transaction([
      this.prisma.driverVerificationRequest.update({
        where: { id },
        data: {
          status: VerificationRequestStatus.APPROVED,
          approvedAt: new Date(),
          approvedById,
          bufferExpiresAt,
        },
      }),
      // Create verification action log
      this.prisma.verificationAction.create({
        data: {
          verificationRequestId: id,
          actionType: 'APPROVED',
          actionById: approvedById,
        },
      }),
    ]);

    // Capture after state
    const afterSnapshot = {
      verificationId: id,
      status: updated.status,
      bufferExpiresAt: bufferExpiresAt.toISOString(),
      bufferDurationMinutes: this.bufferDurationMinutes,
      approvedAt: updated.approvedAt?.toISOString(),
    };

    // DO NOT update driver status yet - stays PENDING during buffer
    // DO NOT update document statuses yet - stay PENDING during buffer
    // This allows revert window before driver actually becomes active

    // Schedule buffer finalization job
    await this.verificationQueue.scheduleVerificationFinalization(id, bufferExpiresAt);

    // Notify driver about approval (but they can't accept rides yet)
    this.firebaseService.notifyAllSessions(
      verification.driver.id,
      'driver',
      {
        notification: {
          title: 'Verification Approved!',
          body: 'Your documents have been verified. Processing will complete shortly.',
        },
        data: {
          event: FcmEventType.DriverVerificationUpdate,
          status: 'APPROVED',
        },
      },
      this.prisma,
    );

    return {
      ...updated,
      bufferExpiresAt,
      bufferDurationMinutes: this.bufferDurationMinutes,
      __auditMetadata: {
        beforeSnapshot,
        afterSnapshot,
        entityId: id,
      },
    };
  }

  /**
   * Reject entire verification
   */
  async rejectVerification(id: string, rejectionReason: string, rejectedById: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    if (!rejectionReason || rejectionReason.length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters');
    }

    // Capture before state
    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      driver: {
        id: verification.driver.id,
        name: `${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
        phoneNumber: verification.driver.phoneNumber,
        verificationStatus: verification.driver.verificationStatus,
      },
    };

    // Update verification, create action log, and update driver status in transaction
    const [updated] = await this.prisma.$transaction([
      this.prisma.driverVerificationRequest.update({
        where: { id },
        data: {
          status: VerificationRequestStatus.REJECTED,
          revertReason: rejectionReason, // Reusing field for rejection reason
        },
      }),
      this.prisma.verificationAction.create({
        data: {
          verificationRequestId: id,
          actionType: 'REJECTED',
          reason: rejectionReason,
          actionById: rejectedById,
        },
      }),
      this.prisma.driver.update({
        where: { id: verification.driver.id },
        data: { verificationStatus: VerificationStatus.REJECTED },
      }),
    ]);

    // Capture after state
    const afterSnapshot = {
      verificationId: id,
      status: updated.status,
      rejectionReason,
      driver: {
        verificationStatus: 'REJECTED',
      },
    };

    // Fire-and-forget: Notify driver about rejection (outside transaction)
    this.firebaseService.notifyAllSessions(
      verification.driver.id,
      'driver',
      {
        notification: {
          title: 'Verification Rejected',
          body: `Your verification was rejected: ${rejectionReason}`,
        },
        data: {
          event: FcmEventType.DriverVerificationUpdate,
          status: 'REJECTED',
          reason: rejectionReason,
        },
      },
      this.prisma,
    ).catch(error => {
      this.logger.error(`Failed to notify driver ${verification.driver.id} about rejection`, error);
    });

    return {
      ...updated,
      __auditMetadata: {
        beforeSnapshot,
        afterSnapshot,
        entityId: id,
      },
    };
  }

  /**
   * Request revert (within buffer window)
   */
  async requestRevert(id: string, dto: RevertRequestDto, requestedById: string) {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found');
    }

    // Check if in buffer window
    if (verification.status !== VerificationRequestStatus.APPROVED) {
      throw new BadRequestException('Can only request revert for approved verifications');
    }

    if (!verification.bufferExpiresAt || new Date() > verification.bufferExpiresAt) {
      throw new BadRequestException('Buffer window has expired, cannot request revert');
    }

    // Validate reason
    if (!dto.reason || dto.reason.length < 10) {
      throw new BadRequestException('Revert reason must be at least 10 characters');
    }

    // Capture before state
    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      driver: {
        id: verification.driver.id,
        name: `${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
        phoneNumber: verification.driver.phoneNumber,
      },
      bufferExpiresAt: verification.bufferExpiresAt?.toISOString(),
      approvedAt: verification.approvedAt?.toISOString(),
    };

    // Cancel pending finalization job
    await this.verificationQueue.cancelVerificationFinalization(id);

    // Update verification and create action log
    const [updated] = await this.prisma.$transaction([
      this.prisma.driverVerificationRequest.update({
        where: { id },
        data: {
          status: VerificationRequestStatus.REVERT_REQUESTED,
          revertReason: dto.reason,
          revertRequestedById: requestedById,
          revertRequestedAt: new Date(),
        },
      }),
      this.prisma.verificationAction.create({
        data: {
          verificationRequestId: id,
          actionType: 'REVERT_REQUESTED',
          reason: dto.reason,
          actionById: requestedById,
        },
      }),
    ]);

    // Capture after state
    const afterSnapshot = {
      verificationId: id,
      status: updated.status,
      revertReason: dto.reason,
      revertRequestedAt: updated.revertRequestedAt?.toISOString(),
    };

    return {
      ...updated,
      __auditMetadata: {
        beforeSnapshot,
        afterSnapshot,
        entityId: id,
      },
    };
  }

  /**
   * Approve or reject revert request (Admin only)
   */
  async handleRevertRequest(id: string, approve: boolean, handledById: string, handlerRole: AdminRole) {
    // Only Admin or Super Admin can handle revert requests
    if (handlerRole !== AdminRole.ADMIN && handlerRole !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Admin or Super Admin can handle revert requests');
    }

    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            documents: true,
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

    // Capture before state
    const beforeSnapshot = {
      verificationId: id,
      status: verification.status,
      revertReason: verification.revertReason,
      driver: {
        id: verification.driver.id,
        name: `${verification.driver.firstName ?? ''} ${verification.driver.lastName ?? ''}`.trim(),
        phoneNumber: verification.driver.phoneNumber,
        verificationStatus: verification.driver.verificationStatus,
      },
      documents: verification.driver.documents ? {
        licenseStatus: verification.driver.documents.licenseStatus,
        rcBookStatus: verification.driver.documents.rcBookStatus,
        fcStatus: verification.driver.documents.fcStatus,
        insuranceStatus: verification.driver.documents.insuranceStatus,
      } : null,
    };

    if (approve) {
      // Revert everything back to pending and create action log
      await this.prisma.$transaction([
        this.prisma.driverVerificationRequest.update({
          where: { id },
          data: {
            status: VerificationRequestStatus.REVERTED,
            bufferExpiresAt: null,
            approvedAt: null,
            approvedById: null,
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
      ]);

      // Reset document statuses (but keep document actions history)
      if (verification.driver.documents) {
        await this.prisma.driverDocuments.update({
          where: { id: verification.driver.documents.id },
          data: {
            licenseStatus: VerificationStatus.PENDING,
            rcBookStatus: VerificationStatus.PENDING,
            fcStatus: VerificationStatus.PENDING,
            insuranceStatus: VerificationStatus.PENDING,
          },
        });
      }

      // Capture after state for approval
      const afterSnapshot = {
        verificationId: id,
        status: 'REVERTED',
        decision: 'APPROVED',
        driver: {
          verificationStatus: 'PENDING',
        },
        documents: {
          licenseStatus: 'PENDING',
          rcBookStatus: 'PENDING',
          fcStatus: 'PENDING',
          insuranceStatus: 'PENDING',
        },
      };

      return {
        success: true,
        message: 'Revert approved - verification reset to pending',
        [AUDIT_METADATA_KEY]: {
          beforeSnapshot,
          afterSnapshot,
          entityId: id,
        },
      };
    } else {
      // Reject revert - restore to approved and create action log
      await this.prisma.$transaction([
        this.prisma.driverVerificationRequest.update({
          where: { id },
          data: {
            status: VerificationRequestStatus.APPROVED,
            revertReason: null,
            revertRequestedById: null,
            revertRequestedAt: null,
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

      // Capture after state for rejection
      const afterSnapshot = {
        verificationId: id,
        status: 'APPROVED',
        decision: 'REJECTED',
        revertReason: null,
      };

      return {
        success: true,
        message: 'Revert rejected - verification remains approved',
        [AUDIT_METADATA_KEY]: {
          beforeSnapshot,
          afterSnapshot,
          entityId: id,
        },
      };
    }
  }

  /**
   * Finalize a specific verification (called by Bull queue processor)
   * This is where Driver.verificationStatus and DriverDocuments statuses get updated
   * Only runs after buffer expires
   */
  async finalizeVerificationById(verificationId: string): Promise<void> {
    const verification = await this.prisma.driverVerificationRequest.findUnique({
      where: { id: verificationId },
      include: { driver: { include: { documents: true } } },
    });

    if (!verification) {
      throw new NotFoundException(`Verification ${verificationId} not found`);
    }

    // Only finalize if still in APPROVED status (not reverted)
    if (verification.status !== VerificationRequestStatus.APPROVED) {
      this.logger.log(`Verification ${verificationId} is no longer APPROVED (${verification.status}), skipping finalization`);
      return; // Skip - status changed (likely reverted)
    }

    // Execute all updates in a transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // 1. Update verification to FINAL_APPROVED
      await tx.driverVerificationRequest.update({
        where: { id: verificationId },
        data: { status: VerificationRequestStatus.FINAL_APPROVED },
      });

      // 2. Update driver status to VERIFIED (driver can now accept rides)
      await tx.driver.update({
        where: { id: verification.driver.id },
        data: { verificationStatus: VerificationStatus.VERIFIED },
      });

      // 3. Update all document statuses to VERIFIED
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

    this.logger.log(`Successfully finalized verification ${verificationId} - driver ${verification.driver.id} is now VERIFIED`);

    // Fire-and-forget: Notify driver that they can now accept rides (outside transaction)
    this.firebaseService.notifyAllSessions(
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
    ).catch(error => {
      this.logger.error(`Failed to notify driver ${verification.driver.id} about finalization`, error);
    });
  }

  /**
   * Check if verification is in buffer window
   */
  isInBuffer(verification: { status: VerificationRequestStatus; bufferExpiresAt: Date | null }): boolean {
    if (verification.status !== VerificationRequestStatus.APPROVED) {
      return false;
    }
    if (!verification.bufferExpiresAt) {
      return false;
    }
    return new Date() < verification.bufferExpiresAt;
  }

  /**
   * Get remaining buffer time in seconds
   */
  getBufferRemainingSeconds(bufferExpiresAt: Date | null): number {
    if (!bufferExpiresAt) return 0;
    const remaining = bufferExpiresAt.getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }
}
