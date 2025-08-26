import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserToken, UserType } from '../../common/types/user-session.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    let user: UserToken;
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient();
      user = client.data.user;
    } else {
      const request = context.switchToHttp().getRequest();
      user = request.user;
    }

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (!requiredRoles.includes(user.userType)) {
      throw new ForbiddenException('Access denied for role: ' + user.userType);
    }

    return true;
  }
}