import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AdminRefundStatus } from '@prisma/client';

export class ListRefundsDto {
  @ApiProperty({ enum: AdminRefundStatus, required: false })
  @IsEnum(AdminRefundStatus)
  @IsOptional()
  status?: AdminRefundStatus;

  @ApiProperty({ description: 'Filter by booking ID', required: false })
  @IsString()
  @IsOptional()
  bookingId?: string;

  @ApiProperty({ description: 'Filter by customer ID', required: false })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ description: 'Filter by driver ID', required: false })
  @IsString()
  @IsOptional()
  driverId?: string;

  @ApiProperty({ description: 'Search in booking ID or reason', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
