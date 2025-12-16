import { Expose, Type } from 'class-transformer';
import { RefundIntentResponseDto } from './transaction-log.dto';

export class CustomerWalletLogResponseDto {
  @Expose()
  id: string;

  @Expose()
  beforeBalance: number;

  @Expose()
  afterBalance: number;

  @Expose()
  amount: number;

  @Expose()
  reason: string;

  @Expose()
  bookingId: string | null;

  @Expose()
  refundIntentId: string | null;

  @Expose()
  @Type(() => RefundIntentResponseDto)
  refundIntent: RefundIntentResponseDto | null;

  @Expose()
  createdAt: Date;
}
