/**
 * Roles Guard
 *
 * Checks if the authenticated admin user has the required role(s).
 * Must be used after AdminAuthGuard.
 */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AdminJwtPayload } from '../admin-auth.service';

// Role hierarchy: SUPER_ADMIN > ADMIN > (AGENT | FIELD_AGENT | CUSTOMER_SUPPORT)
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  [AdminRole.SUPER_ADMIN]: 100,
  [AdminRole.ADMIN]: 80,
  [AdminRole.AGENT]: 50,
  [AdminRole.FIELD_AGENT]: 50,
  [AdminRole.CUSTOMER_SUPPORT]: 50,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, allow access (auth-only check)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AdminJwtPayload = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied');
    }

    // Super Admin has access to everything
    if (user.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    // Admin has access to Admin and below
    if (user.role === AdminRole.ADMIN) {
      const userLevel = ROLE_HIERARCHY[user.role];
      const requiredLevel = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY[r]));
      if (userLevel >= requiredLevel) {
        return true;
      }
    }

    // Check if user's role is in the required roles
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
