import { IsString, IsNumber, IsOptional, Min, MinLength, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRefundDto {
  @ApiProperty({ description: 'Booking ID for the refund' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Customer ID (optional, validated against booking)' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ description: 'Refund amount (must be > 0 and <= booking total)' })
  @IsNumber()
  @Min(1, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiProperty({ description: 'Cancellation charge (optional, defaults to 0, must be <= booking total)' })
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Cancellation charge must be >= 0' })
  cancellationCharge?: number;

  @ApiProperty({ description: 'Reason for refund (min 10 chars)' })
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  reason: string;

  @ApiProperty({ description: 'Additional notes (optional)' })
  @IsString()
  @IsOptional()
  notes?: string;
}
