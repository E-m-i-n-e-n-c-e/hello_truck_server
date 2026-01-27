import { IsString, IsEnum, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DriverVerificationType, VerificationRequestStatus } from '@prisma/client';

export class ListVerificationsDto {
  @ApiProperty({ enum: VerificationRequestStatus, required: false })
  @IsOptional()
  @IsEnum(VerificationRequestStatus)
  status?: VerificationRequestStatus;

  @ApiProperty({ enum: DriverVerificationType, required: false })
  @IsOptional()
  @IsEnum(DriverVerificationType)
  verificationType?: DriverVerificationType;

  @ApiProperty({ required: false, description: 'Filter by assigned agent ID' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiProperty({ required: false, description: 'Filter by driver ID' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ required: false, description: 'Start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, description: 'End date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, description: 'Search by driver name, phone number, or ticket ID' })
  @IsOptional()
  @IsString()
  search?: string;

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
