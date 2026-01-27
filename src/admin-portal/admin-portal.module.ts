/**
 * AdminPortalModule - Root module for the Admin Portal
 *
 * This module is loaded when APP_MODE=admin or APP_MODE=all.
 * It contains all admin-specific functionality:
 * - Multi-user authentication (AdminUser)
 * - Role-based access control (RBAC)
 * - Audit logging
 * - Driver verification workflow
 * - Refund management
 * - Customer support dashboard
 * - Field verification
 * - Admin notifications
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { validateAdminEnv } from './config/admin-env.config';

// Local Prisma and Redis modules for admin portal
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AdminSessionModule } from './session/admin-session.module';

// Admin Portal sub-modules
import { AdminFirebaseModule } from './firebase/admin-firebase.module';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminUsersModule } from './users/admin-users.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { VerificationModule } from './verification/verification.module';
import { AdminRefundModule } from './refund/admin-refund.module';
import { SupportModule } from './support/support.module';
import { FieldVerificationModule } from './field-verification/field-verification.module';
import { AdminNotificationsModule } from './notifications/admin-notifications.module';

@Module({
  imports: [
    // Core config - admin has its own env validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateAdminEnv,
    }),

    // Schedule module for cron jobs
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: seconds(60),
      limit: 100, // Lower limit for admin - more sensitive operations
    }]),

    // Local infrastructure (Prisma, Redis) - independent from main app
    PrismaModule,
    RedisModule,
    AdminSessionModule,  // Session management (must be before Firebase)

    // Admin modules
    AdminFirebaseModule,     // Firebase (FCM, Storage)
    AdminAuthModule,         // Authentication
    AdminUsersModule,        // User management
    AuditLogModule,          // Audit logging for all portal users
    VerificationModule,      // Driver verification workflow
    AdminRefundModule,       // Refund management
    SupportModule,           // Customer support dashboard
    FieldVerificationModule, // Field agent verification
    AdminNotificationsModule, // Admin in-app notifications
  ],
  controllers: [],
  providers: [],
})
export class AdminPortalModule {}
