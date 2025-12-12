import { Expose } from 'class-transformer';

export class DriverWalletLogResponseDto {
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
  createdAt: Date;
}
