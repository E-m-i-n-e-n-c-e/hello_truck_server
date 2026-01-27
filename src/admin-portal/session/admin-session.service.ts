/**
 * Admin Session Service
 *
 * Manages admin user sessions with refresh tokens for JWT-based authentication.
 * Sessions are tied to refresh tokens stored in HTTP-only cookies.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CreateSessionData {
  adminUserId: string;
  refreshToken: string; // Plain token to hash
  userAgent?: string;
  ipAddress?: string;
  fcmToken?: string; // For web push notifications
  expiresInDays?: number; // Default 30 days
}

export interface SessionValidationResult {
  valid: boolean;
  sessionId?: string;
  adminUserId?: string;
}

@Injectable()
export class AdminSessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session with hashed refresh token
   */
  async createSession(data: CreateSessionData) {
    const { adminUserId, refreshToken, userAgent, ipAddress, fcmToken, expiresInDays = 30 } = data;

    // Hash the refresh token before storing
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const session = await this.prisma.adminSession.create({
      data: {
        adminUserId,
        refreshTokenHash,
        userAgent,
        ipAddress,
        fcmToken,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    return session;
  }

  /**
   * Validate refresh token and return session info
   */
  async validateRefreshToken(refreshToken: string): Promise<SessionValidationResult> {
    const refreshTokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.adminSession.findUnique({
      where: { refreshTokenHash },
      include: { adminUser: true },
    });

    if (!session) {
      return { valid: false };
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      // Delete expired session
      await this.deleteSession(session.id);
      return { valid: false };
    }

    // Check if user is still active
    if (!session.adminUser.isActive) {
      return { valid: false };
    }

    // Update last used timestamp
    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      sessionId: session.id,
      adminUserId: session.adminUserId,
    };
  }

  /**
   * Delete a specific session (single device logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.adminSession.delete({
      where: { id: sessionId },
    }).catch(() => {
      // Ignore if already deleted
    });
  }

  /**
   * Delete session by refresh token hash
   */
  async deleteSessionByToken(refreshToken: string): Promise<void> {
    const refreshTokenHash = this.hashToken(refreshToken);
    await this.prisma.adminSession.delete({
      where: { refreshTokenHash },
    }).catch(() => {
      // Ignore if already deleted
    });
  }

  /**
   * Delete all sessions for a user (logout all devices)
   */
  async deleteAllUserSessions(adminUserId: string): Promise<void> {
    await this.prisma.adminSession.deleteMany({
      where: { adminUserId },
    });
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(adminUserId: string) {
    return this.prisma.adminSession.findMany({
      where: {
        adminUserId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        fcmToken: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Update FCM token for a session
   */
  async updateSessionFcmToken(sessionId: string, fcmToken: string): Promise<void> {
    await this.prisma.adminSession.update({
      where: { id: sessionId },
      data: { fcmToken },
    });
  }

  /**
   * Get session by refresh token (for updating fcmToken)
   */
  async getSessionByRefreshToken(refreshToken: string) {
    const refreshTokenHash = this.hashToken(refreshToken);
    return this.prisma.adminSession.findUnique({
      where: { refreshTokenHash },
    });
  }

  /**
   * Get all sessions with FCM tokens for a user (for notifications)
   */
  async getUserSessionsWithFcm(adminUserId: string) {
    return this.prisma.adminSession.findMany({
      where: {
        adminUserId,
        expiresAt: { gt: new Date() },
        fcmToken: { not: null },
      },
      select: {
        id: true,
        fcmToken: true,
        lastNotifiedAt: true,
      },
    });
  }

  /**
   * Update last notified timestamp for sessions (called by Firebase service after sending notifications)
   */
  async updateLastNotifiedForSessions(sessionIds: string[]): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { id: { in: sessionIds } },
      data: { lastNotifiedAt: new Date() },
    });
  }

  /**
   * Clean up expired sessions (can be run as a cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.adminSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  /**
   * Hash token using SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
