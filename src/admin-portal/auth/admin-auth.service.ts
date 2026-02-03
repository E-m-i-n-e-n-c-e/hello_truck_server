/**
 * Admin Auth Service
 *
 * Handles admin authentication logic:
 * - Password validation with bcrypt
 * - JWT token generation (access + refresh)
 * - Session management
 * - Current user retrieval
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSessionService } from '../session/admin-session.service';
import { AdminFirebaseService } from '../firebase/admin-firebase.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AdminRole } from '@prisma/client';

export interface AdminJwtPayload {
  sub: string; // userId
  email: string;
  role: AdminRole;
}

export interface AdminTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: AdminRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

@Injectable()
export class AdminAuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: AdminSessionService,
    private readonly adminFirebaseService: AdminFirebaseService,
  ) {}

  /**
   * Validate admin credentials and return JWT tokens
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<AdminTokenResponse> {
    // Find user by email
    const user = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated. Contact administrator.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate access token (JWT)
    const payload: AdminJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Generate refresh token (random string)
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Create session with hashed refresh token
    await this.sessionService.createSession({
      adminUserId: user.id,
      refreshToken,
      userAgent,
      ipAddress,
      expiresInDays: this.REFRESH_TOKEN_EXPIRY_DAYS,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Validate refresh token and get session
    const session = await this.sessionService.validateRefreshToken(refreshToken);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Get user
    const user = await this.prisma.adminUser.findUnique({
      where: { id: session.adminUserId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    // Generate new access token
    const payload: AdminJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    return { accessToken };
  }

  /**
   * Get current user from JWT payload
   */
  async getCurrentUser(userId: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    return user;
  }

  /**
   * Hash a password for storage
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async resetPasswordWithGoogle(
    email: string,
    newPassword: string,
    googleIdToken: string,
  ): Promise<{ id: string; email: string; role: AdminRole }> {
    const normalizedEmail = email.toLowerCase().trim();

    const googleData = await this.adminFirebaseService.verifyGoogleIdToken(googleIdToken);

    if (!googleData.email || !googleData.emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    if (googleData.email.toLowerCase().trim() !== normalizedEmail) {
      throw new UnauthorizedException('Google account email does not match');
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated. Contact administrator.');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all existing sessions after password change
    await this.sessionService.deleteAllUserSessions(user.id);

    return { id: user.id, email: user.email, role: user.role };
  }
}
