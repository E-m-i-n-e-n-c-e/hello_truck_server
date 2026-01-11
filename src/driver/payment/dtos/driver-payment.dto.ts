import { Expose } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class GeneratePaymentLinkDto {
  @IsNumber()
  @Min(1)
  amount: number;
}

export class PaymentLinkResponseDto {
  @Expose()
  paymentLinkUrl: string;

  @Expose()
  paymentLinkId: string;

  @Expose()
  amount: number;

  @Expose()
  expiresAt: number;
}
