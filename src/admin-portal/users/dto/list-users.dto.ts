import { IsString, IsEnum, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

export class ListUsersDto {
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
