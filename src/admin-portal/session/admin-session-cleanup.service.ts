/**
 * Admin Session Cleanup Service
 *
 * Handles automatic cleanup of expired admin sessions:
 * - Runs daily via cron
 * - Deletes sessions that have passed their expiry date
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminSessionService } from './admin-session.service';

@Injectable()
export class AdminSessionCleanupService {
  private readonly logger = new Logger(AdminSessionCleanupService.name);

  constructor(private readonly sessionService: AdminSessionService) {}

  /**
   * Run daily at 3 AM to cleanup expired sessions
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredSessions() {
    this.logger.log('Starting admin session cleanup...');

    try {
      const deletedCount = await this.sessionService.cleanupExpiredSessions();
      
      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} expired admin sessions`);
      } else {
        this.logger.log('No expired sessions to clean up');
      }

      return { deleted: deletedCount };
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error);
      throw error;
    }
  }

  /**
   * Manual trigger for cleanup (for testing or manual admin action)
   */
  async triggerCleanup(): Promise<{ deleted: number }> {
    return this.cleanupExpiredSessions();
  }
}
