/**
 * Roles Decorator
 *
 * Decorator to specify required roles for a route.
 *
 * Usage:
 * @Roles(AdminRole.SUPER_ADMIN)
 * @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
 */
import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
