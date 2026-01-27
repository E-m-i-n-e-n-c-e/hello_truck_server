/**
 * Admin Session Module
 *
 * Provides session management for admin portal authentication
 * - AdminSessionService: CRUD operations for sessions
 * - AdminSessionCleanupService: Cron job for expired session cleanup
 */
import { Module, Global } from '@nestjs/common';
import { AdminSessionService } from './admin-session.service';
import { AdminSessionCleanupService } from './admin-session-cleanup.service';

@Global()
@Module({
  providers: [AdminSessionService, AdminSessionCleanupService],
  exports: [AdminSessionService],
})
export class AdminSessionModule {}
