/**
 * Audit Log Module
 *
 * Provides comprehensive logging for ALL admin portal user actions.
 * Logs actions from: Super Admin, Admin, Agent, Field Agent, Customer Support.
 *
 * Captured events include:
 * - Authentication events (login/logout)
 * - Verification actions (approve/reject documents)
 * - Refund actions (create/approve refunds)
 * - Support team actions (view bookings, add notes)
 * - Field verification actions (upload photos, submit)
 * - User management actions (create/update users)
 *
 * Archival:
 * - Logs older than 90 days are automatically archived to Firebase Storage
 * - Cron job runs daily at 2 AM
 */
import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogArchiveService } from './audit-log-archive.service';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

@Global() // Make available everywhere for logging
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // For archival cron
  ],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    AuditLogArchiveService,
    // Global interceptor to log all requests
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditLogService, AuditLogArchiveService],
})
export class AuditLogModule {}

