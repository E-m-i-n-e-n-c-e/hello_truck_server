/**
 * Admin Notifications Service
 *
 * Handles:
 * - Storing notifications in database for in-app display
 * - Delegating web push to AdminFirebaseService
 * - Managing read/unread status
 *
 * Note: All FCM/push notification logic is in AdminFirebaseService
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';
import { AdminRole } from '@prisma/client';
import { AdminMessagingPayload, AdminNotificationEventType, AdminFcmTopicType } from '../types/admin-notification.types';

export interface AdminNotificationInput {
  title: string;
  message: string;
  entityId?: string;
  entityType?: 'VERIFICATION' | 'REFUND' | 'DRIVER' | 'BOOKING';
  driverId?: string; // For verification-related notifications
  actionUrl?: string;
}

export interface SendNotificationOptions {
  userId?: string;           // Target specific user
  roles?: AdminRole[];       // Target all users with specific roles
  useTopic?: boolean;        // Use FCM topic for efficient broadcast (only works with roles)
  topic?: AdminFcmTopicType; // FCM topic name (required if useTopic is true)
  event: AdminNotificationEventType; // Event type for FCM payload
}

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: AdminFirebaseService,
  ) {}

  /**
   * Send notification to admin user(s)
   * 1. Stores in DB for in-app display
   * 2. Delegates to FirebaseService for web push
   *
   * Supports two modes:
   * - Individual: Sends to specific users via their FCM tokens
   * - Broadcast: Sends to FCM topic (efficient for multiple users)
   */
  async sendNotification(
    input: AdminNotificationInput,
    options: SendNotificationOptions,
  ): Promise<void> {
    const { userId, roles, useTopic, topic, event } = options;

    // Get target users
    let targetUsers: { id: string }[] = [];

    if (userId) {
      targetUsers = [{ id: userId }];
    } else if (roles && roles.length > 0) {
      targetUsers = await this.prisma.adminUser.findMany({
        where: {
          role: { in: roles },
          isActive: true,
        },
        select: { id: true },
      });
    }

    if (targetUsers.length === 0) {
      this.logger.warn('No target users for notification');
      return;
    }

    // 1. Store in database for in-app notifications
    await this.prisma.adminNotification.createMany({
      data: targetUsers.map(user => ({
        userId: user.id,
        title: input.title,
        message: input.message,
        entityId: input.entityId,
        entityType: input.entityType,
        driverId: input.driverId,
        actionUrl: input.actionUrl,
        isRead: false,
      })),
    });

    // 2. Send web push via FirebaseService
    const pushPayload: AdminMessagingPayload = {
      notification: {
        title: input.title,
        body: input.message,
      },
      data: {
        event,
        ...(input.entityId && { entityId: input.entityId }),
        ...(input.entityType && { entityType: input.entityType }),
        ...(input.driverId && { driverId: input.driverId }),
        ...(input.actionUrl && { actionUrl: input.actionUrl }),
      },
    };

    // Use topic broadcast if enabled (efficient for multiple users)
    if (useTopic && topic && roles) {
      await this.firebaseService.notifyTopic(topic, pushPayload);
      this.logger.log(`Sent notification to ${targetUsers.length} admin users via topic: ${topic}`);
    } else {
      // Send to each user's sessions individually
      for (const user of targetUsers) {
        await this.firebaseService.notifyAdminSessions(user.id, pushPayload);
      }
      this.logger.log(`Sent notification to ${targetUsers.length} admin users`);
    }
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {},
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = options;

    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminNotification.count({ where }),
      this.prisma.adminNotification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.adminNotification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.adminNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Get unread count for badge
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.adminNotification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Dashboard summary — role-differentiated.
   *
   * Two raw SQL queries run in parallel (Promise.all):
   *  1. Notifications: window function counts total unread in one scan, LIMIT 5 rows returned.
   *  2. Stats: conditional aggregation (COUNT FILTER) covers all counters in one table scan.
   *
   * Total: 2 round trips regardless of role.
   */
  async getSummary(userId: string, role: AdminRole) {
    const isAdmin = role === AdminRole.ADMIN || role === AdminRole.SUPER_ADMIN;

    // ── Query 1: notifications ────────────────────────────────────────────────
    // Window function computes total unread across ALL user's rows (correct count),
    // but only 5 rows are returned by LIMIT. Sort done in DB.
    type NotifRow = {
      id: string;
      userId: string;
      title: string;
      message: string;
      entityId: string | null;
      entityType: string | null;
      driverId: string | null;
      actionUrl: string | null;
      isRead: boolean;
      createdAt: Date;
      totalUnread: bigint;
    };

    // ── Query 2a (admin): single table scan, 6 conditional counters ───────────
    type AdminStatsRow = {
      totalActive: bigint;
      unassigned: bigint;
      inReview: bigint;
      reverted: bigint;
      revertRequested: bigint;
      myAssignments: bigint;
      pendingRefundRequests: bigint;
      refundRevertRequests: bigint;
      revertedRefundRequests: bigint;
    };

    // ── Query 2b (agent): single table scan, 4 conditional counters ───────────
    type AgentStatsRow = {
      myActive: bigint;
      reverted: bigint;
      inReview: bigint;
      revertRequested: bigint;
    };

    type SupportStatsRow = {
      pendingRefundRequests: bigint;
      refundRevertRequests: bigint;
      revertedRefundRequests: bigint;
    };

    const [notifRows, statsRows] = await Promise.all([
      this.prisma.$queryRaw<NotifRow[]>`
        SELECT
          id,
          "userId",
          title,
          message,
          "entityId",
          "entityType",
          "driverId",
          "actionUrl",
          "isRead",
          "createdAt",
          COUNT(*) FILTER (WHERE "isRead" = false) OVER () AS "totalUnread"
        FROM "AdminNotification"
        WHERE "userId" = ${userId}
        ORDER BY "createdAt" DESC
        LIMIT 5
      `,

      isAdmin
        ? this.prisma.$queryRaw<AdminStatsRow[]>`
            WITH latest_requests AS (
              SELECT DISTINCT ON ("driverId")
                id,
                "driverId",
                status,
                "assignedToId"
              FROM "DriverVerificationRequest"
              ORDER BY "driverId", "createdAt" DESC
            ),
            latest_refunds AS (
              SELECT DISTINCT ON ("bookingId")
                id,
                "bookingId",
                status
              FROM "AdminRefundRequest"
              ORDER BY "bookingId", "createdAt" DESC
            )
            SELECT
              COUNT(*) FILTER (WHERE status = ANY(ARRAY['PENDING','IN_REVIEW','REVERT_REQUESTED','REVERTED','APPROVED']::"VerificationRequestStatus"[])) AS "totalActive",
              COUNT(*) FILTER (WHERE status = ANY(ARRAY['PENDING','IN_REVIEW','REVERT_REQUESTED','REVERTED','APPROVED']::"VerificationRequestStatus"[]) AND "assignedToId" IS NULL) AS "unassigned",
              COUNT(*) FILTER (WHERE status = 'IN_REVIEW'::"VerificationRequestStatus") AS "inReview",
              COUNT(*) FILTER (WHERE status = 'REVERTED'::"VerificationRequestStatus") AS "reverted",
              COUNT(*) FILTER (WHERE status = 'REVERT_REQUESTED'::"VerificationRequestStatus") AS "revertRequested",
              COUNT(*) FILTER (WHERE status = ANY(ARRAY['PENDING','IN_REVIEW','REVERT_REQUESTED','REVERTED','APPROVED']::"VerificationRequestStatus"[]) AND "assignedToId" = ${userId}) AS "myAssignments",
              (SELECT COUNT(*) FROM latest_refunds WHERE status = 'PENDING'::"AdminRefundStatus") AS "pendingRefundRequests",
              (SELECT COUNT(*) FROM latest_refunds WHERE status = 'REVERT_REQUESTED'::"AdminRefundStatus") AS "refundRevertRequests",
              (SELECT COUNT(*) FROM latest_refunds WHERE status = 'REVERTED'::"AdminRefundStatus") AS "revertedRefundRequests"
            FROM latest_requests
          `
        : role === AdminRole.CUSTOMER_SUPPORT
          ? this.prisma.$queryRaw<SupportStatsRow[]>`
              WITH latest_refunds AS (
                SELECT DISTINCT ON ("bookingId")
                  id,
                  "bookingId",
                  status,
                  "createdById"
                FROM "AdminRefundRequest"
                ORDER BY "bookingId", "createdAt" DESC
              )
              SELECT
                COUNT(*) FILTER (
                  WHERE status = 'PENDING'::"AdminRefundStatus"
                  AND "createdById" = ${userId}
                ) AS "pendingRefundRequests",
                COUNT(*) FILTER (
                  WHERE status = 'REVERT_REQUESTED'::"AdminRefundStatus"
                  AND "createdById" = ${userId}
                ) AS "refundRevertRequests",
                COUNT(*) FILTER (
                  WHERE status = 'REVERTED'::"AdminRefundStatus"
                  AND "createdById" = ${userId}
                ) AS "revertedRefundRequests"
              FROM latest_refunds
            `
          : this.prisma.$queryRaw<AgentStatsRow[]>`
            WITH latest_requests AS (
              SELECT DISTINCT ON ("driverId")
                id,
                "driverId",
                status,
                "assignedToId"
              FROM "DriverVerificationRequest"
              ORDER BY "driverId", "createdAt" DESC
            )
            SELECT
              COUNT(*) FILTER (WHERE "assignedToId" = ${userId} AND status = ANY(ARRAY['PENDING','IN_REVIEW','REVERT_REQUESTED','REVERTED','APPROVED']::"VerificationRequestStatus"[])) AS "myActive",
              COUNT(*) FILTER (WHERE "assignedToId" = ${userId} AND status = 'REVERTED'::"VerificationRequestStatus") AS "reverted",
              COUNT(*) FILTER (WHERE "assignedToId" = ${userId} AND status = 'IN_REVIEW'::"VerificationRequestStatus") AS "inReview",
              COUNT(*) FILTER (WHERE "assignedToId" = ${userId} AND status = 'REVERT_REQUESTED'::"VerificationRequestStatus") AS "revertRequested"
            FROM latest_requests
          `,
    ]);

    // PostgreSQL COUNT returns BigInt — coerce all to Number
    const unreadNotifications = notifRows.length > 0 ? Number(notifRows[0].totalUnread) : 0;
    const recentNotifications = notifRows.map(({ totalUnread: _drop, ...n }) => n);

    const rawStats = (statsRows as (AdminStatsRow | AgentStatsRow)[])[0] ?? {};
    const stats = Object.fromEntries(
      Object.entries(rawStats).map(([k, v]) => [k, Number(v)]),
    );

    return {
      role: isAdmin
        ? ('admin' as const)
        : role === AdminRole.CUSTOMER_SUPPORT
          ? ('support' as const)
          : ('agent' as const),
      stats,
      recentNotifications,
      unreadNotifications,
    };
  }
}
