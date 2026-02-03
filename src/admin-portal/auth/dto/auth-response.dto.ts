import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

/**
 * Admin User Response DTO
 */
export class AdminUserResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty({ enum: AdminRole })
  @Expose()
  role: AdminRole;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  lastName: string;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}

/**
 * Login Response DTO
 */
export class LoginResponseDto {
  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty({ type: AdminUserResponseDto })
  @Expose()
  @Type(() => AdminUserResponseDto)
  user: AdminUserResponseDto;

  @ApiProperty({ description: 'Access token (JWT)' })
  @Expose()
  accessToken: string;

  @ApiProperty({ description: 'Refresh token (also set in httpOnly cookie)' })
  @Expose()
  refreshToken: string;
}

/**
 * Refresh Token Response DTO
 */
export class RefreshTokenResponseDto {
  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty({ description: 'New access token' })
  @Expose()
  accessToken: string;
}

/**
 * Current User Response DTO
 */
export class CurrentUserResponseDto extends AdminUserResponseDto {}

/**
 * Update FCM Token Response DTO
 */
export class UpdateFcmTokenResponseDto {
  @ApiProperty()
  @Expose()
  message: string;
}

/**
 * Logout Response DTO
 */
export class LogoutResponseDto {
  @ApiProperty()
  @Expose()
  message: string;
}

/**
 * Password Recovery Reset Response DTO
 */
export class PasswordRecoveryResetResponseDto {
  @ApiProperty()
  @Expose()
  message: string;
}
