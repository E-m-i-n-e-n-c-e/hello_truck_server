/**
 * Audit Log Archive Service
 *
 * Handles automatic archival of old audit logs:
 * - Runs daily via cron
 * - Archives logs older than 90 days to Firebase Storage
 * - Deletes archived logs from the database
 *
 * Archived files are stored as: audit-logs/archive/{year}/{month}/audit-logs-{date}.json
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';

@Injectable()
export class AuditLogArchiveService {
  private readonly logger = new Logger(AuditLogArchiveService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly firebaseService: AdminFirebaseService,
  ) {
    this.retentionDays = this.configService.get<number>('AUDIT_LOG_RETENTION_DAYS', 90);
  }

  /**
   * Run daily at 2 AM to archive old logs
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async archiveOldLogs() {
    this.logger.log('Starting audit log archival...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      // Find logs older than retention period
      const logsToArchive = await this.prisma.auditLog.findMany({
        where: {
          timestamp: { lt: cutoffDate },
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      if (logsToArchive.length === 0) {
        this.logger.log('No logs to archive');
        return { archived: 0 };
      }

      this.logger.log(`Found ${logsToArchive.length} logs to archive`);

      // Group logs by date for easier retrieval
      const logsByDate = this.groupLogsByDate(logsToArchive);

      // Upload each date's logs to storage
      for (const [dateKey, logs] of Object.entries(logsByDate)) {
        await this.uploadToStorage(dateKey, logs);
      }

      // Delete archived logs from database
      const deleteResult = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
        },
      });

      this.logger.log(`Archived and deleted ${deleteResult.count} logs`);

      return { archived: deleteResult.count };
    } catch (error) {
      this.logger.error('Failed to archive audit logs', error);
      throw error;
    }
  }

  /**
   * Group logs by date (YYYY-MM-DD)
   */
  private groupLogsByDate(logs: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const log of logs) {
      const dateKey = log.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(this.formatLogForArchive(log));
    }

    return grouped;
  }

  /**
   * Format log entry for archive (flatten user data)
   */
  private formatLogForArchive(log: any) {
    return {
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      userId: log.userId,
      userEmail: log.user?.email,
      userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
      role: log.role,
      actionType: log.actionType,
      module: log.module,
      description: log.description,
      entityId: log.entityId,
      entityType: log.entityType,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      beforeSnapshot: log.beforeSnapshot,
      afterSnapshot: log.afterSnapshot,
    };
  }

  /**
   * Upload logs to Firebase Storage
   */
  private async uploadToStorage(dateKey: string, logs: any[]): Promise<void> {
    if (!this.firebaseService.isInitialized()) {
      this.logger.warn('Firebase not initialized, skipping upload');
      return;
    }

    try {
      // Create path: audit-logs/archive/2026/01/audit-logs-2026-01-15.json
      const [year, month] = dateKey.split('-');
      const filePath = `audit-logs/archive/${year}/${month}/audit-logs-${dateKey}.json`;

      // Check if file already exists (in case of re-runs)
      const existingLogs = await this.firebaseService.downloadJson<any[]>(filePath);
      if (existingLogs) {
        logs = [...existingLogs, ...logs];
      }

      // Upload JSON
      const success = await this.firebaseService.uploadJson(filePath, logs, {
        logsCount: logs.length.toString(),
        archiveDate: new Date().toISOString(),
      });

      if (success) {
        this.logger.log(`Uploaded ${logs.length} logs to ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to upload logs for ${dateKey}`, error);
      throw error;
    }
  }

  /**
   * Manual trigger for archival (Super Admin only)
   */
  async triggerArchival(): Promise<{ archived: number }> {
    return this.archiveOldLogs();
  }

  /**
   * Get list of archived files (for retrieval)
   */
  async listArchivedFiles(year?: string, month?: string): Promise<string[]> {
    if (!this.firebaseService.isInitialized()) {
      return [];
    }

    let prefix = 'audit-logs/archive/';
    if (year) {
      prefix += `${year}/`;
      if (month) {
        prefix += `${month}/`;
      }
    }

    return this.firebaseService.listFiles(prefix);
  }

  /**
   * Download archived logs for a specific date
   */
  async getArchivedLogs(dateKey: string): Promise<any[] | null> {
    if (!this.firebaseService.isInitialized()) {
      return null;
    }

    const [year, month] = dateKey.split('-');
    const filePath = `audit-logs/archive/${year}/${month}/audit-logs-${dateKey}.json`;

    return this.firebaseService.downloadJson<any[]>(filePath);
  }
}
