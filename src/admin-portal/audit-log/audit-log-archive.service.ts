/**
 * Audit Log Archive Service
 *
 * Handles automatic archival of old audit logs:
 * - Runs daily via cron
 * - Archives logs older than 90 days to Firebase Storage
 * - Deletes archived logs from the database
 *
 * Archived files are stored as CSV under audit-logs/archive/{year}/{month}/...
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';

interface ArchiveAuditLogsResult {
  archived: number;
  filePath: string | null;
  fileUrl: string | null;
  deletedFrom: string | null;
  deletedTo: string | null;
}

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
      const result = await this.archiveLogsForWhere(
        {
          timestamp: { lt: cutoffDate },
        },
        'cron',
      );

      if (result.archived === 0) {
        this.logger.log('No logs to archive');
      } else {
        this.logger.log(
          `Archived and deleted ${result.archived} logs to ${result.filePath}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to archive audit logs', error);
      throw error;
    }
  }

  /**
   * Manual trigger for archival older than a selected cutoff date.
   */
  async triggerArchival(cutoffDate: string): Promise<ArchiveAuditLogsResult> {
    const cutoff = new Date(cutoffDate);

    if (Number.isNaN(cutoff.getTime())) {
      throw new BadRequestException('Invalid archive cutoff date');
    }

    cutoff.setHours(0, 0, 0, 0);

    return this.archiveLogsForWhere(
      {
        timestamp: {
          lt: cutoff,
        },
      },
      'manual',
    );
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
   * Convert logs into CSV content for storage.
   */
  private buildCsv(logs: any[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'User Email',
      'User Name',
      'Role',
      'Action Type',
      'Module',
      'Description',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent',
      'Before Snapshot',
      'After Snapshot',
    ];

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const rows = logs.map((log) => {
      const formatted = this.formatLogForArchive(log);
      return [
        formatted.id,
        formatted.timestamp,
        formatted.userId,
        formatted.userEmail,
        formatted.userName,
        formatted.role,
        formatted.actionType,
        formatted.module,
        formatted.description,
        formatted.entityType,
        formatted.entityId,
        formatted.ipAddress,
        formatted.userAgent,
        formatted.beforeSnapshot,
        formatted.afterSnapshot,
      ].map(escapeCsv).join(',');
    });

    return [headers.map((header) => `"${header}"`).join(','), ...rows].join('\n');
  }

  /**
   * Shared archival function used by both cron and manual trigger.
   */
  private async archiveLogsForWhere(
    where: { timestamp: Prisma.DateTimeFilter },
    trigger: 'cron' | 'manual',
  ): Promise<ArchiveAuditLogsResult> {
    const logsToArchive = await this.prisma.auditLog.findMany({
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
      orderBy: { timestamp: 'asc' },
    });

    if (logsToArchive.length === 0) {
      return {
        archived: 0,
        filePath: null,
        fileUrl: null,
        deletedFrom: null,
        deletedTo: null,
      };
    }

    if (!this.firebaseService.isInitialized()) {
      throw new BadRequestException('Firebase storage is not initialized');
    }

    const oldestTimestamp = logsToArchive[0].timestamp;
    const newestTimestamp = logsToArchive[logsToArchive.length - 1].timestamp;
    const oldestDate = oldestTimestamp.toISOString().split('T')[0];
    const newestDate = newestTimestamp.toISOString().split('T')[0];
    const archiveStamp = new Date().toISOString().replace(/[:.]/g, '-');
    const [year, month] = oldestDate.split('-');
    const filePath = `audit-logs/archive/${year}/${month}/audit-logs-${oldestDate}-to-${newestDate}-${trigger}-${archiveStamp}.csv`;
    const csvContent = this.buildCsv(logsToArchive);

    const fileUrl = await this.firebaseService.uploadTextFile(
      filePath,
      csvContent,
      'text/csv',
      {
        logsCount: logsToArchive.length.toString(),
        archiveTrigger: trigger,
        deletedFrom: oldestTimestamp.toISOString(),
        deletedTo: newestTimestamp.toISOString(),
      },
    );

    if (!fileUrl) {
      throw new BadRequestException('Failed to upload archive CSV');
    }

    await this.prisma.auditLog.deleteMany({
      where: {
        id: {
          in: logsToArchive.map((log) => log.id),
        },
      },
    });

    return {
      archived: logsToArchive.length,
      filePath,
      fileUrl,
      deletedFrom: oldestTimestamp.toISOString(),
      deletedTo: newestTimestamp.toISOString(),
    };
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
