import { Expose, Type } from 'class-transformer';
import {
  TransactionType,
  TransactionCategory,
  Transaction,
  $Enums,
  PaymentMethod,
} from '@prisma/client';
import { BookingResponseDto } from 'src/booking/dtos/booking.dto';
import { ValidateNested } from 'class-validator';

export class RefundIntentResponseDto {
  @Expose()
  id: string;

  @Expose()
  status: string;

  @Expose()
  walletRefundAmount: number;

  @Expose()
  razorpayRefundAmount: number;

  @Expose()
  cancellationCharge: number;

  @Expose()
  rzpRefundId: string | null;

  @Expose()
  createdAt: Date;

  @Expose()
  processedAt: Date | null;
}

export class CustomerTransactionLogResponseDto {
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
  @ValidateNested()
  @Type(() => BookingResponseDto)
  booking: BookingResponseDto | null;

  @Expose()
  payoutId: string | null;

  @Expose()
  refundIntentId: string | null;

  @Expose()
  @Type(() => RefundIntentResponseDto)
  refundIntent: RefundIntentResponseDto | null;

  @Expose()
  paymentMethod: PaymentMethod;

  @Expose()
  createdAt: Date;
}
