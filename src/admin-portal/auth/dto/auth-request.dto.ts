import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Login Request DTO
 */
export class LoginRequestDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}

/**
 * Refresh Token Request DTO
 */
export class RefreshTokenRequestDto {
  @ApiProperty({ description: 'Refresh token (from cookie or body)', required: false })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

/**
 * Update FCM Token Request DTO
 */
export class UpdateFcmTokenRequestDto {
  @ApiProperty({ description: 'FCM token for web push notifications' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}

/**
 * Logout Request DTO (no body needed, uses cookie)
 */
export class LogoutRequestDto {
  // No fields - uses refresh token from cookie
}

/**
 * Password Recovery Reset Request DTO
 *
 * Resets an admin password after verifying a Google ID token.
 */
export class PasswordRecoveryResetRequestDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Google ID token (JWT) from client sign-in' })
  @IsString()
  @IsNotEmpty()
  googleIdToken: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  newPassword: string;
}
