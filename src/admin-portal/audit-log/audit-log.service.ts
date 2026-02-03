/**
 * Audit Log Service
 *
 * Provides methods to create and query audit log entries.
 * All admin portal user actions should be logged through this service.
 * Captures actions from: Super Admin, Admin, Agent, Field Agent, Customer Support.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRole, Prisma } from '@prisma/client';
import { ListLogsRequestDto } from './dto/audit-log-request.dto';

export interface CreateAuditLogInput {
  userId: string;
  role: AdminRole;
  actionType: string;
  module: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  beforeSnapshot?: Record<string, any>;
  afterSnapshot?: Record<string, any>;
  entityId?: string;
  entityType?: string;
}

// Action types
export const AuditActionTypes = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_RECOVERY_RESET: 'PASSWORD_RECOVERY_RESET',

  // Verification
  VERIFICATION_ASSIGNED: 'VERIFICATION_ASSIGNED',
  DOCUMENT_APPROVED: 'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  VERIFICATION_APPROVED: 'VERIFICATION_APPROVED',
  VERIFICATION_REJECTED: 'VERIFICATION_REJECTED',
  REVERT_REQUESTED: 'REVERT_REQUESTED',
  REVERT_APPROVED: 'REVERT_APPROVED',
  REVERT_REJECTED: 'REVERT_REJECTED',

  // Refund
  REFUND_CREATED: 'REFUND_CREATED',
  REFUND_APPROVED: 'REFUND_APPROVED',
  REFUND_REJECTED: 'REFUND_REJECTED',
  REFUND_REVERT_REQUESTED: 'REFUND_REVERT_REQUESTED',
  REFUND_REVERT_APPROVED: 'REFUND_REVERT_APPROVED',
  REFUND_REVERT_REJECTED: 'REFUND_REVERT_REJECTED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',

  // Support
  BOOKING_VIEWED: 'BOOKING_VIEWED',
  DRIVER_LOCATION_FETCHED: 'DRIVER_LOCATION_FETCHED',
  SUPPORT_NOTE_ADDED: 'SUPPORT_NOTE_ADDED',

  // Field Verification
  FIELD_PHOTO_UPLOADED: 'FIELD_PHOTO_UPLOADED',
  FIELD_VERIFICATION_SUBMITTED: 'FIELD_VERIFICATION_SUBMITTED',

  // User Management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',

  // System
  BUFFER_EXPIRED: 'BUFFER_EXPIRED',
} as const;

// Module names
export const AuditModules = {
  AUTH: 'AUTH',
  VERIFICATION: 'VERIFICATION',
  REFUND: 'REFUND',
  SUPPORT: 'SUPPORT',
  FIELD_VERIFICATION: 'FIELD_VERIFICATION',
  USER_MANAGEMENT: 'USER_MANAGEMENT',
  SYSTEM: 'SYSTEM',
} as const;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Serialize data to plain JSON, removing any non-serializable properties
   */
  private serializeToJson(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }
    // Use JSON.parse(JSON.stringify()) to ensure clean serialization
    try {
      const serialized = JSON.parse(JSON.stringify(data));
      // Debug: Log if serialization resulted in empty object when input wasn't empty
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        const serializedKeys = Object.keys(serialized || {});
        if (serializedKeys.length === 0) {
          console.warn('[AuditLogService] Serialization resulted in empty object:', {
            originalKeys: Object.keys(data),
            originalData: data,
          });
        }
      }
      return serialized;
    } catch (error) {
      console.error('[AuditLogService] Failed to serialize audit snapshot:', error);
      return null;
    }
  }

  /**
   * Create a new audit log entry
   * Supports transaction context for atomic operations
   */
  async log(input: CreateAuditLogInput, tx?: Prisma.TransactionClient): Promise<void> {
    const prisma = tx || this.prisma;

    // Serialize snapshots to ensure they're plain JSON objects
    const beforeSnapshot = this.serializeToJson(input.beforeSnapshot);
    const afterSnapshot = this.serializeToJson(input.afterSnapshot);

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        role: input.role,
        actionType: input.actionType,
        module: input.module,
        description: input.description,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        beforeSnapshot: beforeSnapshot as Prisma.InputJsonValue,
        afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
        entityId: input.entityId,
        entityType: input.entityType,
      },
    });
  }

  /**
   * List audit logs with filters
   */
  async listLogs(filters: ListLogsRequestDto) {
    const {
      userId,
      actionType,
      module,
      entityId,
      entityType,
      startDate,
      endDate,
      search,
      userSearch,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
      where.userId = userId;
    }

    if (actionType) {
      where.actionType = actionType;
    }

    if (module) {
      where.module = module;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    // Date range filter (mandatory in UI, but optional in API)
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }

    // User search filter - searches both name and email
    if (userSearch) {
      where.user = {
        OR: [
          { email: { contains: userSearch, mode: 'insensitive' } },
          { firstName: { contains: userSearch, mode: 'insensitive' } },
          { lastName: { contains: userSearch, mode: 'insensitive' } },
        ],
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single log entry by ID
   */
  async getLogById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Export logs to CSV format (returns data, UI handles download)
   */
  async exportLogs(filters: ListLogsRequestDto) {
    // Limit export to last 30 days and max 10000 records
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const where: Prisma.AuditLogWhereInput = {
      timestamp: {
        gte: filters.startDate ? new Date(filters.startDate) : thirtyDaysAgo,
        lte: filters.endDate ? new Date(filters.endDate) : new Date(),
      },
    };

    // Apply all filters
    if (filters.userId) where.userId = filters.userId;
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.module) where.module = filters.module;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.search) {
      where.description = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters.userSearch) {
      where.user = {
        OR: [
          { email: { contains: filters.userSearch, mode: 'insensitive' } },
          { firstName: { contains: filters.userSearch, mode: 'insensitive' } },
          { lastName: { contains: filters.userSearch, mode: 'insensitive' } },
        ],
      };
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    return logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      user: `${log.user.firstName} ${log.user.lastName}`,
      email: log.user.email,
      role: log.role,
      action: log.actionType,
      module: log.module,
      description: log.description,
      entityType: log.entityType || '',
      entityId: log.entityId || '',
      ipAddress: log.ipAddress || '',
    }));
  }
}
