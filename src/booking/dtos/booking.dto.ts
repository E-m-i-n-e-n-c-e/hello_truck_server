import { IsOptional, ValidateNested, IsString } from 'class-validator';
import { Type, Exclude } from 'class-transformer';
import { $Enums, Driver, VehicleType } from '@prisma/client';
import {
  CreateBookingAddressDto,
  BookingAddressResponseDto,
} from './booking-address.dto';
import { PackageDetailsDto, PackageDetailsResponseDto } from './package.dto';
import { Expose } from 'class-transformer';
import { InvoiceResponseDto } from './booking-invoice.dto';
import { BookingAssignmentResponseDto } from './booking-assignment.dto';

export class CreateBookingRequestDto {
  @ValidateNested()
  @Type(() => CreateBookingAddressDto)
  pickupAddress: CreateBookingAddressDto;

  @ValidateNested()
  @Type(() => CreateBookingAddressDto)
  dropAddress: CreateBookingAddressDto;

  @ValidateNested()
  @Type(() => PackageDetailsDto)
  package: PackageDetailsDto;

  @IsOptional()
  @IsString()
  gstNumber?: string;
}

class DriverResponseDto implements Partial<Driver> {
  @Expose()
  phoneNumber: string;
  @Expose()
  firstName: string | null;
  @Expose()
  lastName: string | null;
  @Expose()
  email: string | null;
  @Expose()
  photo: string | null;
  @Expose()
  score: number;
  @Expose()
  rideCount: number;
}

export class BookingResponseDto {
  @Expose()
  id: string;
  @Expose()
  bookingNumber: number;
  @Expose()
  @Type(() => BookingAddressResponseDto)
  pickupAddress: BookingAddressResponseDto;
  @Expose()
  @Type(() => BookingAddressResponseDto)
  dropAddress: BookingAddressResponseDto;
  @Expose()
  pickupOtp: string;
  @Expose()
  dropOtp: string;
  @Expose()
  @Type(() => PackageDetailsResponseDto)
  package: PackageDetailsResponseDto;
  @Expose()
  @Type(() => InvoiceResponseDto)
  invoices: InvoiceResponseDto[];
  @Expose()
  status: $Enums.BookingStatus;
  @Expose()
  @Type(() => DriverResponseDto)
  assignedDriver: DriverResponseDto | null;
  @Expose()
  acceptedAt: Date | null;
  @Expose()
  pickupArrivedAt: Date | null;
  @Expose()
  pickupVerifiedAt: Date | null;
  @Expose()
  dropArrivedAt: Date | null;
  @Expose()
  dropVerifiedAt: Date | null;
  @Expose()
  completedAt: Date | null;
  @Expose()
  cancelledAt: Date | null;
  @Expose()
  cancellationReason: string | null;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  scheduledAt: Date | null;
}

/**
 * Driver-specific booking DTO that excludes OTP fields for security
 * Drivers should not see pickup/drop OTPs in the booking response
 */
export class DriverBookingResponseDto extends BookingResponseDto {
  @Exclude()
  declare pickupOtp: string;

  @Exclude()
  declare dropOtp: string;
}

/**
 * Cancelled assignment with cancellation charge info
 */
export class CancelledAssignmentResponseDto {
  @Expose()
  bookingId: string;

  @Expose()
  bookingNumber: number;

  @Expose()
  cancelledAt: Date;

  @Expose()
  cancellationReason: string | null;

  @Expose()
  cancellationCharge: number; // Amount credited to driver from wallet log

  @Expose()
  @Type(() => BookingAddressResponseDto)
  pickupAddress: BookingAddressResponseDto;

  @Expose()
  @Type(() => BookingAddressResponseDto)
  dropAddress: BookingAddressResponseDto;

  @Expose()
  @Type(() => PackageDetailsResponseDto)
  package: PackageDetailsResponseDto;
}

/**
 * Base earnings response with common fields
 */
class BaseEarningsDto {
  @Expose()
  totalRides: number;

  @Expose()
  netEarnings: number; // Driver's net earnings after commission deduction

  @Expose()
  commissionRate: number; // Platform commission rate (e.g., 0.07 = 7%)

  @Expose()
  netCompensation: number; // Total cancellation compensation earned

  @Expose()
  totalCancelledRides: number; // Count of cancelled rides with compensation

  @Expose()
  @Type(() => BookingAssignmentResponseDto)
  assignments: BookingAssignmentResponseDto[];

  @Expose()
  @Type(() => CancelledAssignmentResponseDto)
  cancelledAssignments: CancelledAssignmentResponseDto[];
}

/**
 * Ride summary for single date (backward compatible)
 */
export class RideSummaryDto extends BaseEarningsDto {
  @Expose()
  date: string; // YYYY-MM-DD format
}

/**
 * Earnings summary for date range (startDate to endDate)
 */
export class EarningsSummaryResponseDto extends BaseEarningsDto {
  @Expose()
  startDate: string; // YYYY-MM-DD format

  @Expose()
  endDate: string; // YYYY-MM-DD format
}

export class CancelBookingDto {
  @IsString()
  reason: string;
}

export class CancellationConfigResponseDto {
  @Expose()
  minChargePercent: number;

  @Expose()
  maxChargePercent: number;

  @Expose()
  incrementPerMin: number;
}
