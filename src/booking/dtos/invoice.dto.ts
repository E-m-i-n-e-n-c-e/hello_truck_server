import { Expose, Type } from 'class-transformer';
import { InvoiceType } from '@prisma/client';

export class InvoiceResponseDto {
  @Expose()
  id: string;

  @Expose()
  bookingId: string;

  @Expose()
  type: InvoiceType;

  @Expose()
  vehicleModelName: string;

  @Expose()
  basePrice: number;

  @Expose()
  perKmPrice: number;

  @Expose()
  baseKm: number;

  @Expose()
  distanceKm: number;

  @Expose()
  weightInTons: number;

  @Expose()
  effectiveBasePrice: number;

  @Expose()
  totalPrice: number;

  @Expose()
  walletApplied: number;

  @Expose()
  finalAmount: number;

  @Expose()
  paymentLinkUrl: string;

  @Expose()
  rzpOrderId: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
