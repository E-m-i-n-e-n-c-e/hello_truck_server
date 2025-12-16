import { Expose, Type } from 'class-transformer';
import { BookingResponseDto } from 'src/booking/dtos/booking.dto';

export class PendingRefundResponseDto {
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
  @Type(() => BookingResponseDto)
  booking: BookingResponseDto;

  @Expose()
  createdAt: Date;

  @Expose()
  processedAt: Date | null;

  @Expose()
  failureReason: string | null;
}
