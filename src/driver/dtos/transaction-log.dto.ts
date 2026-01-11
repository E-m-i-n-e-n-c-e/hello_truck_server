import { Expose, Type } from 'class-transformer';
import { TransactionType, TransactionCategory, Transaction, $Enums, PaymentMethod, PayoutStatus } from '@prisma/client';
import { BookingResponseDto } from 'src/booking/dtos/booking.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class PayoutResponseDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  amount: number;

  @Expose()
  razorpayPayoutId: string | null;

  @Expose()
  status: PayoutStatus;

  @Expose()
  failureReason: string | null;

  @Expose()
  retryCount: number;

  @Expose()
  createdAt: Date;

  @Expose()
  processedAt: Date | null;
}

export class DriverTransactionLogResponseDto {
  @Expose()
  id: string;

  @Expose()
  customerId: string | null;

  @Expose()
  driverId: string | null;

  @Expose()
  amount: number;

  @Expose()
  type: TransactionType; // CREDIT or DEBIT

  @Expose()
  category: TransactionCategory;

  @Expose()
  description: string;

  @Expose()
  bookingId: string | null;

  @Expose()
  @Type(() => BookingResponseDto)
  booking: BookingResponseDto | null;

  @Expose()
  payoutId: string | null;

  @Expose()
  @Type(() => PayoutResponseDto)
  payout: PayoutResponseDto | null;

  @Expose()
  paymentMethod: PaymentMethod;

  @Expose()
  createdAt: Date;
}

export class GetTransactionLogsDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includePayments?: boolean = false; // Default: only show payouts, not driver payments to platform
}
