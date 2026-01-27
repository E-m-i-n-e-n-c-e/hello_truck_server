/**
 * Current Admin User Decorator
 *
 * Extracts the current admin user from the request.
 * Returns the AdminJwtPayload.
 *
 * Usage:
 * @CurrentAdminUser() user: AdminJwtPayload
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminJwtPayload } from '../admin-auth.service';

export const CurrentAdminUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AdminJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
