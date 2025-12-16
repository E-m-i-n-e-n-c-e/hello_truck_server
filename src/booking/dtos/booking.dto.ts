import { IsOptional, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { $Enums, Driver, VehicleType } from '@prisma/client';
import { CreateBookingAddressDto, BookingAddressResponseDto } from './booking-address.dto';
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
  @Type(() => PackageDetailsResponseDto)
  package: PackageDetailsResponseDto;
  @Expose()
  @Type(() => InvoiceResponseDto)
  invoices: InvoiceResponseDto[];
  @Expose()
  status: $Enums.BookingStatus;
  @Expose()
  assignedDriverId: string | null;
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
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  scheduledAt: Date | null;
}

export class RideSummaryDto {
  @Expose()
  totalRides: number;

  @Expose()
  netEarnings: number; // Driver's net earnings after commission deduction

  @Expose()
  commissionRate: number; // Platform commission rate (e.g., 0.07 = 7%)

  @Expose()
  date: string; // YYYY-MM-DD format

  @Expose()
  @Type(() => BookingAssignmentResponseDto)
  assignments: BookingAssignmentResponseDto[]; // Completed assignments with bookings for the day
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
  incrementPerMinute: number;
}