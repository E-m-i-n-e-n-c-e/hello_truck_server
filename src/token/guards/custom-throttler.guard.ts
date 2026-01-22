import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { TokenService } from '../token.service';
import { UserToken } from '../../common/types/user-session.types';
import { Reflector } from '@nestjs/core';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly options: ThrottlerModuleOptions,
    protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {
    super(options, storageService, reflector);
  }

  async getTracker(req: Record<string, any>): Promise<string> {
    // Get the IP address and route
    const ip = req.ip;
    const route = req.route?.path || 'unknown';
    let userId = 'anonymous';

    // Try to get the JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const user: UserToken = await this.tokenService.validateAccessToken(token);
        if (user?.userId) {
          userId = user.userId;
        }
      } catch (error) {
        // If token is invalid, just use IP-based limiting
        // console.warn('Invalid JWT token for rate limiting', error);
      }
    }

    // Combine IP, route and user ID for rate limiting
    return `${ip}-${route}-${userId}`;
  }
}