import { $Enums, InvoiceType } from '@prisma/client';
import { Expose } from 'class-transformer';

/**
 * Shared DTOs duplicated from booking module
 * These are duplicated to avoid coupling between admin-portal and booking modules
 * When admin-portal is moved to a separate codebase, these will remain independent
 */

export class BookingAddressResponseDto {
  @Expose()
  addressName: string | null;
  @Expose()
  contactName: string;
  @Expose()
  contactPhone: string;
  @Expose()
  noteToDriver: string | null;
  @Expose()
  latitude: number;
  @Expose()
  longitude: number;
  @Expose()
  formattedAddress: string;
  @Expose()
  addressDetails: string | null;
}

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
  platformFee: number;

  @Expose()
  totalPrice: number;

  @Expose()
  gstNumber: string | null;

  @Expose()
  walletApplied: number;

  @Expose()
  finalAmount: number;

  @Expose()
  paymentLinkUrl: string | null;

  @Expose()
  rzpPaymentLinkId: string | null;

  @Expose()
  rzpPaymentId: string | null;

  @Expose()
  isPaid: boolean;

  @Expose()
  paidAt: Date | null;

  @Expose()
  paymentMethod: string | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class PackageDetailsResponseDto {
  @Expose()
  id: string;
  @Expose()
  productType: $Enums.ProductType;
  @Expose()
  approximateWeight: number;
  @Expose()
  weightUnit: $Enums.WeightUnit;

  @Expose()
  productName?: string;

  @Expose()
  bundleWeight?: number;
  @Expose()
  numberOfProducts?: number;
  @Expose()
  length?: number;
  @Expose()
  width?: number;
  @Expose()
  height?: number;
  @Expose()
  dimensionUnit?: $Enums.DimensionUnit;
  @Expose()
  description?: string;

  @Expose()
  packageImageUrl?: string;
  @Expose()
  transportDocUrls: string[];
  @Expose()
  gstBillUrl?: string;

  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}
