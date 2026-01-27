/**
 * Admin JWT Strategy
 *
 * Validates JWT tokens for admin portal authentication.
 * Reads JWT from HTTP-only cookie instead of Bearer header.
 * Uses a separate secret from customer/driver auth.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AdminJwtPayload } from '../admin-auth.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First try to extract from cookie (primary method for web)
        (req: Request) => {
          if (req && req.cookies) {
            return req.cookies['accessToken'];
          }
          return null;
        },
        // Fallback to Bearer token for testing/API clients
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('ADMIN_JWT_SECRET'),
    });
  }

  /**
   * Validate the JWT payload
   * This runs after token signature is verified
   */
  async validate(payload: AdminJwtPayload): Promise<AdminJwtPayload> {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return payload;
  }
}
