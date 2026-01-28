import { IsString, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * List audit logs with filters
 * GET /admin-api/logs
 */
export class ListLogsRequestDto {
  @ApiProperty({ required: false, description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, description: 'Filter by action type (e.g., LOGIN, DOCUMENT_APPROVED)' })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiProperty({ required: false, description: 'Filter by module (e.g., AUTH, VERIFICATION, REFUND)' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiProperty({ required: false, description: 'Filter by entity ID' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({ required: false, description: 'Filter by entity type (e.g., DRIVER, BOOKING)' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiProperty({ required: false, description: 'Start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, description: 'End date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, description: 'Search in description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Search by user name or email' })
  @IsOptional()
  @IsString()
  userSearch?: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20, description: 'Options: 20, 50, 100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
