import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { AdminRefundStatus, BookingStatus } from '@prisma/client';

export class SearchBookingsRequestDto {
  @ApiProperty({ description: 'Customer or driver phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Exact booking ID (UUID)', required: false })
  @IsString()
  @IsOptional()
  bookingId?: string;

  @ApiProperty({ description: 'Booking number', required: false })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  bookingNumber?: number;

  @ApiProperty({ enum: BookingStatus, required: false })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiProperty({ enum: AdminRefundStatus, required: false })
  @IsEnum(AdminRefundStatus)
  @IsOptional()
  latestRefundStatus?: AdminRefundStatus;

  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  hasActiveRefundRequest?: boolean;

  @ApiProperty({ description: 'Start date (ISO string)', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'End date (ISO string)', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class CreateSupportNoteRequestDto {
  @ApiProperty({ description: 'Booking ID to attach note to' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Internal support note content' })
  @IsString()
  @MinLength(1)
  content: string;
}

export class CreateSupportRefundRequestDto {
  @ApiProperty({ description: 'Booking ID for the refund' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Customer ID (optional, validated against booking)', required: false })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ description: 'Refund amount' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Cancellation charge', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  cancellationCharge?: number;

  @ApiProperty({ description: 'Reason for refund (min 10 chars)' })
  @IsString()
  @MinLength(10)
  reason: string;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  evidenceUrls?: string[];
}

export class ListSupportRefundsRequestDto {
  @ApiProperty({ enum: AdminRefundStatus, required: false })
  @IsEnum(AdminRefundStatus)
  @IsOptional()
  status?: AdminRefundStatus;

  @ApiProperty({ enum: BookingStatus, required: false })
  @IsEnum(BookingStatus)
  @IsOptional()
  bookingStatus?: BookingStatus;

  @ApiProperty({ required: false })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  hasActiveRequest?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bookingId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  driverId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  createdById?: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  bookingNumber?: number;

  @ApiProperty({ description: 'Customer or driver phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class RejectSupportRefundRequestDto {
  @ApiProperty({ description: 'Reason for rejection (min 10 chars)' })
  @IsString()
  @MinLength(10)
  reason: string;
}

export class SupportRefundRevertRequestDto {
  @ApiProperty({ description: 'Reason for revert request (min 10 chars)' })
  @IsString()
  @MinLength(10)
  reason: string;
}

export class SupportRefundRevertDecisionRequestDto {
  @ApiProperty({ description: 'true to approve revert, false to reject' })
  @IsBoolean()
  approve: boolean;
}
