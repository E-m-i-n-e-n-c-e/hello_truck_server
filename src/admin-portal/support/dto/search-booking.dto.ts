import { IsString, IsEnum, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BookingStatus } from '@prisma/client';

export class SearchBookingDto {
  @ApiProperty({ description: 'Customer or driver phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Exact booking ID (UUID)', required: false })
  @IsString()
  @IsOptional()
  bookingId?: string;

  @ApiProperty({ description: 'Booking number (auto-incremented number)', required: false })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  bookingNumber?: number;

  @ApiProperty({ enum: BookingStatus, required: false })
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @ApiProperty({ description: 'Start date (ISO format)', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: 'End date (ISO format)', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

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
