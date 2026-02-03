/**
 * Admin Firebase Service
 *
 * Provides Firebase functionality for admin portal:
 * - FCM notifications to drivers/customers
 * - Storage operations (log archival, file uploads)
 *
 * Initializes its own Firebase Admin instance to work
 * independently when APP_MODE=admin.
 */
import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { AppMessagingPayload } from '../types/fcm.types';
import { AdminMessagingPayload } from '../types/admin-notification.types';
import { UserType } from '../../common/types/user-session.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSessionService } from '../session/admin-session.service';

@Injectable()
export class AdminFirebaseService implements OnModuleInit {
  private readonly logger = new Logger(AdminFirebaseService.name);
  private app: admin.app.App | null = null;
  private readonly storageBucket: string;
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: AdminSessionService,
  ) {
    this.storageBucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET', '');
  }

  async onModuleInit() {
    try {
      // Initialize Google Auth Client (independent of Firebase Admin SDK init)
      const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      if (!googleClientId) {
        this.logger.warn('GOOGLE_CLIENT_ID not configured; Google token verification will be unavailable');
      } else {
        this.googleClient = new OAuth2Client(googleClientId);
      }

      // Check if admin app is already initialized
      const existingApp = admin.apps.find(app => app?.name === 'admin-portal');
      if (existingApp) {
        this.app = existingApp;
        this.logger.log('Using existing Firebase Admin instance for admin portal');
        return;
      }

      // Initialize Firebase Admin for admin portal
      const serviceAccountPath = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

      if (!serviceAccountPath) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT_PATH not configured');
        return;
      }

      // Initialize with a named app to avoid conflicts with main app
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        storageBucket: this.storageBucket,
        projectId,
      }, 'admin-portal'); // Named app for admin portal

      this.logger.log('Firebase Admin SDK initialized for admin portal');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      // Don't throw - allow admin portal to work without Firebase
    }
  }

  async verifyGoogleIdToken(idToken: string): Promise<{ email: string; emailVerified: boolean; name?: string }>
  {
    if (!this.googleClient) {
      throw new BadRequestException('Google token verification not configured');
    }

    const audience = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!audience) {
      throw new BadRequestException('Google token verification not configured');
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestException('Invalid token payload');
      }

      return {
        email: payload.email || '',
        emailVerified: payload.email_verified || false,
        name: payload.name,
      };
    } catch (error) {
      this.logger.error('Failed to verify Google ID token', error);
      throw new BadRequestException('Invalid Google ID token');
    }
  }

  /**
   * Check if Firebase is initialized
   */
  isInitialized(): boolean {
    return this.app !== null;
  }

  // ==================== FCM Notifications ====================

  /**
   * Send notification to a single FCM token
   */
  async sendNotification(token: string, payload: AppMessagingPayload) {
    if (!this.app) {
      this.logger.warn('Firebase not initialized, skipping notification');
      return null;
    }

    try {
      return await this.app.messaging().send({
        token,
        notification: payload.notification,
        data: payload.data,
      });
    } catch (error) {
      this.logger.error(`Failed to send notification to ${token}`, error);
      return null;
    }
  }

  /**
   * Notify all sessions for a user (driver or customer)
   * Matches main FirebaseService.notifyAllSessions
   */
  async notifyAllSessions(
    userId: string,
    userType: UserType,
    payload: AppMessagingPayload,
    prisma: PrismaService,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      // Get sessions based on user type
      const sessions = userType === 'driver'
        ? await prisma.driverSession.findMany({
            where: { driverId: userId, fcmToken: { not: null } },
            select: { id: true, fcmToken: true },
          })
        : await prisma.customerSession.findMany({
            where: { customerId: userId, fcmToken: { not: null } },
            select: { id: true, fcmToken: true },
          });

      if (sessions.length === 0) {
        return { successCount: 0, failureCount: 0 };
      }

      // Remove duplicate tokens
      const tokenSet = new Set<string>(sessions.filter(s => s.fcmToken).map(s => s.fcmToken!));
      const tokens: string[] = Array.from(tokenSet);

      const result = await this.app.messaging().sendEachForMulticast({
        tokens,
        notification: payload.notification,
        data: payload.data,
      });

      // Update lastNotifiedAt for all sessions
      const sessionIds = sessions.map(s => s.id);
      if (userType === 'driver') {
        await prisma.driverSession.updateMany({
          where: { id: { in: sessionIds } },
          data: { lastNotifiedAt: new Date() },
        });
      } else {
        await prisma.customerSession.updateMany({
          where: { id: { in: sessionIds } },
          data: { lastNotifiedAt: new Date() },
        });
      }

      return { successCount: result.successCount, failureCount: result.failureCount };
    } catch (error) {
      this.logger.error(`Failed to notify sessions for ${userType} ${userId}`, error);
      return { successCount: 0, failureCount: 0 };
    }
  }

  /**
   * Notify all admin sessions for a user
   * Sends web push notifications to all active admin sessions with FCM tokens
   */
  async notifyAdminSessions(
    adminUserId: string,
    payload: AdminMessagingPayload,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      // Get all admin sessions with FCM tokens
      const sessions = await this.sessionService.getUserSessionsWithFcm(adminUserId);

      if (sessions.length === 0) {
        return { successCount: 0, failureCount: 0 };
      }

      // Remove duplicate tokens
      const tokenSet = new Set<string>(sessions.filter(s => s.fcmToken).map(s => s.fcmToken!));
      const tokens: string[] = Array.from(tokenSet);

      const result = await this.app.messaging().sendEachForMulticast({
        tokens,
        notification: payload.notification,
        data: payload.data as Record<string, string>,
      });

      // Update lastNotifiedAt for all sessions
      const sessionIds = sessions.map(s => s.id);
      await this.sessionService.updateLastNotifiedForSessions(sessionIds);

      return { successCount: result.successCount, failureCount: result.failureCount };
    } catch (error) {
      this.logger.error(`Failed to notify admin sessions for ${adminUserId}`, error);
      return { successCount: 0, failureCount: 0 };
    }
  }

  // ==================== Storage Operations ====================

  /**
   * Get storage bucket reference
   */
  getBucket() {
    if (!this.app) {
      return null;
    }
    return this.app.storage().bucket();
  }

  /**
   * Upload JSON data to storage
   */
  async uploadJson(filePath: string, data: any, metadata?: Record<string, string>): Promise<boolean> {
    const bucket = this.getBucket();
    if (!bucket) {
      this.logger.warn('Storage bucket not available, skipping upload');
      return false;
    }

    try {
      const file = bucket.file(filePath);
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
        metadata: {
          metadata: {
            ...metadata,
            uploadedAt: new Date().toISOString(),
          },
        },
      });
      this.logger.log(`Uploaded to ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to upload ${filePath}`, error);
      return false;
    }
  }

  /**
   * Download JSON data from storage
   */
  async downloadJson<T = any>(filePath: string): Promise<T | null> {
    const bucket = this.getBucket();
    if (!bucket) {
      return null;
    }

    try {
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      return JSON.parse(content.toString()) as T;
    } catch (error) {
      this.logger.error(`Failed to download ${filePath}`, error);
      return null;
    }
  }

  /**
   * Check if file exists in storage
   */
  async fileExists(filePath: string): Promise<boolean> {
    const bucket = this.getBucket();
    if (!bucket) {
      return false;
    }

    try {
      const [exists] = await bucket.file(filePath).exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * List files with a given prefix
   */
  async listFiles(prefix: string): Promise<string[]> {
    const bucket = this.getBucket();
    if (!bucket) {
      return [];
    }

    try {
      const [files] = await bucket.getFiles({ prefix });
      return files.map(file => file.name);
    } catch (error) {
      this.logger.error(`Failed to list files with prefix ${prefix}`, error);
      return [];
    }
  }

  // ==================== Signed URL Generation ====================

  /**
   * Generate signed upload URL for field verification photos
   * Matches main FirebaseService.generateSignedUploadUrl
   *
   * @param filePath - Path where file will be stored in Firebase Storage
   * @param contentType - MIME type of the file (e.g., 'image/jpeg', 'image/png')
   * @param expiresInSeconds - How long the signed URL is valid (default: 300 seconds / 5 minutes)
   * @returns Object containing signedUrl (for upload), publicUrl (for download), and token
   */
  async generateSignedUploadUrl(
    filePath: string,
    contentType: string,
    expiresInSeconds = 300,
  ): Promise<{ signedUrl: string; publicUrl: string; token: string }> {
    if (!this.app) {
      throw new Error('Firebase not initialized');
    }

    const token = uuidv4();

    const bucket = this.app.storage().bucket();
    const file = bucket.file(filePath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInSeconds * 1000,
      contentType,
      extensionHeaders: {
        'x-goog-meta-firebaseStorageDownloadTokens': token,
      },
    });

    const encodedPath = encodeURIComponent(filePath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    return {
      signedUrl,
      publicUrl,
      token,
    };
  }
}
