import { Expose } from 'class-transformer';
import { TransactionType, TransactionCategory } from '@prisma/client';

export class DriverTransactionLogResponseDto {
  @Expose()
  id: string;

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
  payoutId: string | null;

  @Expose()
  createdAt: Date;
}
