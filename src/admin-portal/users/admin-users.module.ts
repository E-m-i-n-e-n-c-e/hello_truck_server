/**
 * Admin Users Module
 *
 * User management for admin portal (Super Admin only):
 * - List users with filters
 * - Create new admin users
 * - Update user details/role
 * - Deactivate users
 */
import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
