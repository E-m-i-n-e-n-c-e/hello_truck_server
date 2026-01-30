import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly options: ThrottlerModuleOptions,
    protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip;
    const route = req.route?.path || 'unknown';
    let userId = 'anonymous';

    // Try to extract token from cookie first, then Bearer header
    let token: string | undefined;

    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (token) {
      try {
        const secret = this.configService.get<string>('ADMIN_JWT_SECRET');
        const payload = this.jwtService.verify(token, { secret });
        if (payload?.sub) {
          userId = payload.sub;
        }
      } catch (error) {
        // Invalid token, use IP-based limiting
      }
    }

    return `${ip}-${route}-${userId}`;
  }
}
