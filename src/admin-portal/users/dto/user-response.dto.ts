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
 * Pagination Metadata Response DTO
 */
export class PaginationResponseDto {
  @ApiProperty()
  @Expose()
  page: number;

  @ApiProperty()
  @Expose()
  limit: number;

  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty()
  @Expose()
  totalPages: number;
}

/**
 * List Users Response DTO
 */
export class ListUsersResponseDto {
  @ApiProperty({ type: [AdminUserResponseDto] })
  @Expose()
  @Type(() => AdminUserResponseDto)
  users: AdminUserResponseDto[];

  @ApiProperty({ type: PaginationResponseDto })
  @Expose()
  @Type(() => PaginationResponseDto)
  pagination: PaginationResponseDto;
}

/**
 * Get User Response DTO
 */
export class GetUserResponseDto extends AdminUserResponseDto {}

/**
 * Create User Response DTO
 */
export class CreateUserResponseDto {
  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty({ type: AdminUserResponseDto })
  @Expose()
  @Type(() => AdminUserResponseDto)
  user: AdminUserResponseDto;
}

/**
 * Update User Response DTO
 */
export class UpdateUserResponseDto {
  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty({ type: AdminUserResponseDto })
  @Expose()
  @Type(() => AdminUserResponseDto)
  user: AdminUserResponseDto;
}

/**
 * Deactivate User Response DTO
 */
export class DeactivateUserResponseDto {
  @ApiProperty()
  @Expose()
  message: string;
}

/**
 * Reactivate User Response DTO
 */
export class ReactivateUserResponseDto {
  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty({ type: AdminUserResponseDto })
  @Expose()
  @Type(() => AdminUserResponseDto)
  user: AdminUserResponseDto;
}
