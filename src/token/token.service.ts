import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { SessionService } from './session/session.service';
import { UserType, User, UserToken } from 'src/common/types/user-session.types';

@Injectable()
export class TokenService {
  constructor(private sessionService: SessionService, private jwtService: JwtService) {}

  async generateAccessToken(user: User, userType: UserType, sessionId: string): Promise<string> {
    const hasCompletedOnboarding = user.firstName !== null;
    const accessToken = await this.jwtService.signAsync({
      userType,
      userId: user.id,
      phoneNumber: user.phoneNumber,
      hasCompletedOnboarding,
      sessionId,
    });

    return accessToken;
  }

  async generateRefreshToken(userId: string, userType: UserType, staleRefreshToken?: string, fcmToken?: string): Promise<string> {
    // If a stale refresh token is provided, delete the session
    if (staleRefreshToken) {
      await this.sessionService.deleteSession(staleRefreshToken.split('.', 2)[0], userType);
    }
    // Create a new session
    const session = await this.sessionService.createSession(userId, userType, fcmToken);

    const refreshToken = `${session.id}.${session.token}`;
    return refreshToken;
  }

  async refreshAccessToken(refreshToken: string, userType: UserType): Promise<{ accessToken: string; refreshToken: string}> {
    if (!refreshToken || !refreshToken.includes('.')) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const [sessionId, tokenValue] = refreshToken.split('.', 2);

    const session = await this.sessionService.findSession(sessionId, userType);

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isCurrentToken = session.token === tokenValue;
    const isOldToken = session.oldToken === tokenValue;

    if (!isCurrentToken && !isOldToken) {
      await this.sessionService.deleteSession(session.id, userType);
      throw new UnauthorizedException('Invalid refresh token - session terminated');
    }

    const newToken = crypto.randomBytes(64).toString('hex');

    await this.sessionService.updateSession(session.id, userType, {
      token: newToken,
        ...(isCurrentToken && { oldToken: session.token }), // Only set oldToken if current token was used
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // Extend 30 days
    });

    const accessToken = await this.generateAccessToken(session.user, userType, session.id);

    return {
      accessToken,
      refreshToken: `${session.id}.${newToken}`,
    };
  }

  async validateRefreshToken(refreshToken: string, userType: UserType): Promise<User> {
    if (!refreshToken || !refreshToken.includes('.')) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const [sessionId, tokenValue] = refreshToken.split('.', 2);

    const session = await this.sessionService.findSession(sessionId, userType);

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if token matches either current or old token
    if (session.token !== tokenValue && session.oldToken !== tokenValue) {
      // Security breach - delete the session
      await this.sessionService.deleteSession(sessionId, userType);
      throw new UnauthorizedException('Invalid refresh token - session terminated');
    }

    return session.user;
  }

  async validateAccessToken(token: string): Promise<UserToken> {
    try {
      const user = await this.jwtService.verifyAsync(token);
      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
