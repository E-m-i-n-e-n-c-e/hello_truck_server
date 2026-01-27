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
import { AdminMessagingPayload } from '../types/admin-notification.types';

export interface AdminNotificationInput {
  title: string;
  message: string;
  entityId?: string;
  entityType?: 'VERIFICATION' | 'REFUND' | 'DRIVER' | 'BOOKING';
  actionUrl?: string;
}

export interface SendNotificationOptions {
  userId?: string;           // Target specific user
  roles?: AdminRole[];       // Target all users with specific roles
  excludeUserId?: string;    // Exclude specific user
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
   */
  async sendNotification(
    input: AdminNotificationInput,
    options: SendNotificationOptions,
  ): Promise<void> {
    const { userId, roles, excludeUserId } = options;

    // Get target users
    let targetUsers: { id: string }[] = [];

    if (userId) {
      targetUsers = [{ id: userId }];
    } else if (roles && roles.length > 0) {
      targetUsers = await this.prisma.adminUser.findMany({
        where: {
          role: { in: roles },
          isActive: true,
          ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
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
        entityId: input.entityId,
        entityType: input.entityType,
        actionUrl: input.actionUrl,
      },
    };

    // Send to each user's sessions
    for (const user of targetUsers) {
      await this.firebaseService.notifyAdminSessions(user.id, pushPayload);
    }

    this.logger.log(`Sent notification to ${targetUsers.length} admin users`);
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
}
