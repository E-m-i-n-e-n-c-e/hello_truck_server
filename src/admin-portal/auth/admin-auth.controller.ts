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
import { Throttle, seconds } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { CurrentAdminUser } from './decorators/current-admin-user.decorator';
import { AdminJwtPayload } from './admin-auth.service';
import { AdminSessionService } from '../session/admin-session.service';
import { ConfigService } from '@nestjs/config';
import { Serialize } from '../common/interceptors/serialize.interceptor';
import { AuditLog } from '../audit-log/decorators/audit-log.decorator';
import { AuditActionTypes, AuditModules } from '../audit-log/audit-log.service';
import {
  LoginRequestDto,
  RefreshTokenRequestDto,
  UpdateFcmTokenRequestDto,
  PasswordRecoveryResetRequestDto,
} from './dto/auth-request.dto';
import {
  LoginResponseDto,
  RefreshTokenResponseDto,
  CurrentUserResponseDto,
  UpdateFcmTokenResponseDto,
  LogoutResponseDto,
  PasswordRecoveryResetResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Admin Auth')
@Throttle({ default: { limit: 10, ttl: seconds(60) } })
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
      secure: true,
      sameSite: 'none' as const, // 'none' required for cross-site cookies (must use with secure in prod)
      path: '/',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Serialize(LoginResponseDto)
  @AuditLog({
    action: AuditActionTypes.LOGIN,
    module: AuditModules.AUTH,
    description: 'User logged in',
    captureRequest: false, // Don't capture password
  })
  @ApiOperation({ summary: 'Admin login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, sets HTTP-only cookies', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
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
  @Serialize(RefreshTokenResponseDto)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Access token refreshed successfully', type: RefreshTokenResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshAccessToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: RefreshTokenRequestDto,
  ): Promise<RefreshTokenResponseDto> {
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
  @Serialize(CurrentUserResponseDto)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current admin user info' })
  @ApiResponse({ status: 200, description: 'Returns current user info', type: CurrentUserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentAdminUser() user: AdminJwtPayload): Promise<CurrentUserResponseDto> {
    return this.authService.getCurrentUser(user.sub);
  }

  @Put('fcm-token')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Serialize(UpdateFcmTokenResponseDto)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update FCM token for web push notifications' })
  @ApiResponse({ status: 200, description: 'FCM token updated successfully', type: UpdateFcmTokenResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateFcmToken(
    @Req() req: Request,
    @Body() dto: UpdateFcmTokenRequestDto,
  ): Promise<UpdateFcmTokenResponseDto> {
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
  @Serialize(LogoutResponseDto)
  @AuditLog({
    action: AuditActionTypes.LOGOUT,
    module: AuditModules.AUTH,
    description: 'User logged out',
  })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (delete session and clear cookies)' })
  @ApiResponse({ status: 200, description: 'Logout successful', type: LogoutResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
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

  @Post('password-recovery/reset')
  @HttpCode(HttpStatus.OK)
  @Serialize(PasswordRecoveryResetResponseDto)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @AuditLog({
    action: AuditActionTypes.PASSWORD_RESET,
    module: AuditModules.AUTH,
    description: 'Password reset via Google verification',
    captureRequest: false, // never capture newPassword/googleIdToken
    captureResponse: false,
  })
  @ApiOperation({ summary: 'Reset admin password after Google sign-in verification' })
  @ApiResponse({ status: 200, description: 'Password updated successfully', type: PasswordRecoveryResetResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or Google token' })
  @ApiResponse({ status: 401, description: 'Email/token mismatch or user not allowed' })
  async passwordRecoveryReset(
    @Req() req: Request,
    @Body() dto: PasswordRecoveryResetRequestDto,
  ): Promise<PasswordRecoveryResetResponseDto> {
    const user = await this.authService.resetPasswordWithGoogle(dto.email, dto.newPassword, dto.googleIdToken);

    // Set request.user so AuditLogInterceptor can log this unauthenticated flow
    (req as any).user = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return { message: 'Password updated successfully' };
  }
}
