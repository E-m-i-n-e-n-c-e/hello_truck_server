import { IsEmail, IsString, MinLength, IsEnum, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

/**
 * Create User Request DTO
 */
export class CreateUserRequestDto {
  @ApiProperty({ example: 'john.doe@hellotruck.in' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.AGENT })
  @IsEnum(AdminRole)
  role: AdminRole;
}

/**
 * Update User Request DTO
 */
export class UpdateUserRequestDto {
  @ApiProperty({ example: 'NewPassword123!', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiProperty({ enum: AdminRole, required: false })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}

/**
 * List Users Request DTO (Query params)
 */
export class ListUsersRequestDto {
  @ApiProperty({ enum: AdminRole, required: false })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiProperty({ example: 'john', required: false, description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
