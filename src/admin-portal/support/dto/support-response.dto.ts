import { Expose, Type } from 'class-transformer';
import { AdminRefundStatus, AdminRole, BookingStatus } from '@prisma/client';
import { BookingAddressResponseDto, InvoiceResponseDto, PackageDetailsResponseDto } from './booking-shared.dto';

export class SupportPaginationResponseDto {
  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  total: number;

  @Expose()
  totalPages: number;
}

export class SupportAdminUserResponseDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  role: AdminRole;

  @Expose()
  email?: string | null;
}

export class SupportCustomerResponseDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  phoneNumber: string;

  @Expose()
  email?: string | null;
}

export class SupportDriverResponseDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  phoneNumber: string;

  @Expose()
  email?: string | null;

  @Expose()
  photo?: string | null;

  @Expose()
  driverStatus?: string;

  @Expose()
  score?: number;

  @Expose()
  rideCount?: number;
}

export class SupportBookingStatusLogResponseDto {
  @Expose()
  id: string;

  @Expose()
  bookingId: string;

  @Expose()
  status: BookingStatus;

  @Expose()
  statusChangedAt: Date;
}

export class SupportBookingBasicResponseDto {
  @Expose()
  id: string;

  @Expose()
  bookingNumber: number;

  @Expose()
  status: BookingStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  completedAt: Date | null;

  @Expose()
  scheduledAt?: Date | null;

  @Expose()
  acceptedAt?: Date | null;

  @Expose()
  pickupArrivedAt?: Date | null;

  @Expose()
  pickupVerifiedAt?: Date | null;

  @Expose()
  dropArrivedAt?: Date | null;

  @Expose()
  dropVerifiedAt?: Date | null;

  @Expose()
  cancelledAt?: Date | null;

  @Expose()
  cancellationReason?: string | null;
}

export class SupportBookingDetailItemResponseDto extends SupportBookingBasicResponseDto {
  @Expose()
  @Type(() => SupportCustomerResponseDto)
  customer?: SupportCustomerResponseDto | null;

  @Expose()
  @Type(() => SupportDriverResponseDto)
  assignedDriver?: SupportDriverResponseDto | null;

  @Expose()
  @Type(() => PackageDetailsResponseDto)
  package?: PackageDetailsResponseDto | null;

  @Expose()
  @Type(() => BookingAddressResponseDto)
  pickupAddress?: BookingAddressResponseDto | null;

  @Expose()
  @Type(() => BookingAddressResponseDto)
  dropAddress?: BookingAddressResponseDto | null;

  @Expose()
  @Type(() => InvoiceResponseDto)
  invoices?: InvoiceResponseDto[];

  @Expose()
  @Type(() => SupportBookingStatusLogResponseDto)
  statusLogs?: SupportBookingStatusLogResponseDto[];
}

export class SupportRefundRequestResponseDto {
  @Expose()
  id: string;

  @Expose()
  bookingId: string;

  @Expose()
  customerId: string;

  @Expose()
  driverId: string | null;

  @Expose()
  amount: number;

  @Expose()
  cancellationCharge: number;

  @Expose()
  reason: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  notes: string | null;

  @Expose()
  evidenceUrls: string[];

  @Expose()
  status: AdminRefundStatus;

  @Expose()
  createdById: string;

  @Expose()
  approvedById: string | null;

  @Expose()
  approvedAt: Date | null;

  @Expose()
  bufferExpiresAt: Date | null;

  @Expose()
  revertReason: string | null;

  @Expose()
  revertRequestedById: string | null;

  @Expose()
  revertRequestedAt: Date | null;

  @Expose()
  rejectionReason: string | null;

  @Expose()
  refundIntentId: string | null;

  @Expose()
  completedAt: Date | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  isInBuffer: boolean;

  @Expose()
  bufferRemainingMinutes: number;

  @Expose()
  @Type(() => SupportBookingDetailItemResponseDto)
  booking?: SupportBookingDetailItemResponseDto | null;

  @Expose()
  @Type(() => SupportCustomerResponseDto)
  customer?: SupportCustomerResponseDto | null;

  @Expose()
  @Type(() => SupportDriverResponseDto)
  driver?: SupportDriverResponseDto | null;

  @Expose()
  @Type(() => SupportAdminUserResponseDto)
  createdBy?: SupportAdminUserResponseDto | null;

  @Expose()
  @Type(() => SupportAdminUserResponseDto)
  approvedBy?: SupportAdminUserResponseDto | null;

  @Expose()
  @Type(() => SupportAdminUserResponseDto)
  revertRequestedBy?: SupportAdminUserResponseDto | null;
}

export class SupportBookingListItemResponseDto {
  @Expose()
  id: string;

  @Expose()
  bookingNumber: number;

  @Expose()
  status: BookingStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  completedAt: Date | null;

  @Expose()
  @Type(() => SupportCustomerResponseDto)
  customer?: SupportCustomerResponseDto | null;

  @Expose()
  @Type(() => SupportDriverResponseDto)
  assignedDriver?: SupportDriverResponseDto | null;

  @Expose()
  @Type(() => SupportRefundRequestResponseDto)
  latestRefundRequest?: SupportRefundRequestResponseDto | null;
}

export class SearchBookingsResponseDto {
  @Expose()
  @Type(() => SupportBookingListItemResponseDto)
  bookings: SupportBookingListItemResponseDto[];

  @Expose()
  @Type(() => SupportPaginationResponseDto)
  pagination: SupportPaginationResponseDto;
}

export class SupportRefundIntentResponseDto {
  @Expose()
  id: string;

  @Expose()
  bookingId: string;

  @Expose()
  customerId: string;

  @Expose()
  walletRefundAmount: number;

  @Expose()
  razorpayRefundAmount: number;

  @Expose()
  cancellationCharge: number;

  @Expose()
  rzpPaymentId: string | null;

  @Expose()
  rzpRefundId: string | null;

  @Expose()
  status: string;

  @Expose()
  failureReason: string | null;

  @Expose()
  retryCount: number;

  @Expose()
  maxRetries: number;

  @Expose()
  createdAt: Date;

  @Expose()
  processedAt: Date | null;

  @Expose()
  wasPaid: boolean;

  @Expose()
  refundFactor: number | null;

  @Expose()
  isApproved: boolean;
}

export class SupportNoteResponseDto {
  @Expose()
  id: string;

  @Expose()
  bookingId: string;

  @Expose()
  agentId: string;

  @Expose()
  agentName: string;

  @Expose()
  note: string;

  @Expose()
  createdAt: Date;
}

export class SupportRefundHistoryResponseDto {
  @Expose()
  @Type(() => SupportRefundIntentResponseDto)
  intents: SupportRefundIntentResponseDto[];

  @Expose()
  @Type(() => SupportRefundRequestResponseDto)
  manual: SupportRefundRequestResponseDto[];

  @Expose()
  @Type(() => SupportRefundRequestResponseDto)
  latestRequest: SupportRefundRequestResponseDto | null;
}

export class SupportBookingDetailResponseDto {
  @Expose()
  @Type(() => SupportBookingDetailItemResponseDto)
  booking: SupportBookingDetailItemResponseDto;

  @Expose()
  @Type(() => SupportRefundHistoryResponseDto)
  refundHistory: SupportRefundHistoryResponseDto;

  @Expose()
  @Type(() => SupportNoteResponseDto)
  notes: SupportNoteResponseDto[];
}

export class ListSupportRefundsResponseDto {
  @Expose()
  @Type(() => SupportRefundRequestResponseDto)
  refunds: SupportRefundRequestResponseDto[];

  @Expose()
  @Type(() => SupportPaginationResponseDto)
  pagination: SupportPaginationResponseDto;
}

export class SupportLiveTrackingResponseDto {
  @Expose()
  driverId: string;

  @Expose()
  bookingId: string | null;

  @Expose()
  latitude: number | null;

  @Expose()
  longitude: number | null;

  @Expose()
  timeToPickup: number | null;

  @Expose()
  timeToDrop: number | null;

  @Expose()
  distanceToPickup: number | null;

  @Expose()
  distanceToDrop: number | null;

  @Expose()
  initialDistanceToPickup: number | null;

  @Expose()
  kmTravelled: number | null;

  @Expose()
  routePolyline: string | null;

  @Expose()
  lastUpdated: string;

  @Expose()
  isStale?: boolean;
}

export type SupportPaginationDto = SupportPaginationResponseDto;
export type SupportRefundRequestDto = SupportRefundRequestResponseDto;
export type SupportBookingsResponseDto = SearchBookingsResponseDto;
export type SupportRefundsResponseDto = ListSupportRefundsResponseDto;
export type SupportNoteDto = SupportNoteResponseDto;
