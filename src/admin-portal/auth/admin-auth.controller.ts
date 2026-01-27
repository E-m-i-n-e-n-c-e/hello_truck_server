/**
 * Admin Auth Controller
 *
 * Endpoints:
 * - POST /admin-api/auth/login - Login with email/password (sets HTTP-only cookies)
 * - POST /admin-api/auth/refresh - Refresh access token
 * - GET /admin-api/auth/me - Get current user info
 * - PUT /admin-api/auth/fcm-token - Update FCM token for web push
 * - POST /admin-api/auth/logout - Logout (delete session + clear cookies)
 */
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';
import { UpsertFcmTokenDto } from './dto/upsert-fcm-token.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { CurrentAdminUser } from './decorators/current-admin-user.decorator';
import { AdminJwtPayload } from './admin-auth.service';
import { AdminSessionService } from '../session/admin-session.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Admin Auth')
@Controller('admin-api/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly sessionService: AdminSessionService,
    private readonly configService: ConfigService,
  ) {}

  private getCookieOptions() {
    const nodeEnv = this.configService.get('NODE_ENV');
    
    return {
      httpOnly: true,
      // IMPORTANT: Set secure to false to allow HTTP localhost to receive cookies
      // In production with HTTPS frontend, this should be true
      secure: false,
      sameSite: 'none' as const, // 'none' required for cross-site cookies (must use with secure in prod)
      path: '/',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, sets HTTP-only cookies' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Extract user agent and IP
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
      userAgent,
      ipAddress,
    );

    // Set HTTP-only cookies (for same-origin requests)
    const cookieOptions = this.getCookieOptions();

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Return tokens in response body for cross-origin requests (frontend should use Bearer token)
    return {
      message: 'Login successful',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Access token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshAccessToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    // Try to get refresh token from body first (for cross-origin), then from cookie
    const refreshToken = body?.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const result = await this.authService.refreshAccessToken(refreshToken);

    // Set new access token cookie
    const cookieOptions = this.getCookieOptions();

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Return access token in body for cross-origin requests
    return { 
      message: 'Access token refreshed successfully',
      accessToken: result.accessToken,
    };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current admin user info' })
  @ApiResponse({ status: 200, description: 'Returns current user info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentAdminUser() user: AdminJwtPayload) {
    return this.authService.getCurrentUser(user.sub);
  }

  @Put('fcm-token')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update FCM token for web push notifications' })
  @ApiResponse({ status: 200, description: 'FCM token updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateFcmToken(
    @Req() req: Request,
    @Body() dto: UpsertFcmTokenDto,
  ) {
    // Extract refresh token from cookie to identify the session
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie not found');
    }

    const session = await this.sessionService.getSessionByRefreshToken(refreshToken);
    
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    await this.sessionService.updateSessionFcmToken(session.id, dto.fcmToken);
    
    return { message: 'FCM token updated successfully' };
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (delete session and clear cookies)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      // Delete session from database
      await this.sessionService.deleteSessionByToken(refreshToken);
    }

    // Clear both cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return { message: 'Logged out successfully' };
  }
}
