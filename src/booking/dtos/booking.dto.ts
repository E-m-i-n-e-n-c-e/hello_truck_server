import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { $Enums, Driver, VehicleType } from '@prisma/client';
import { CreateBookingAddressDto, BookingAddressResponseDto } from './booking-address.dto';
import { PackageDetailsDto, PackageDetailsResponseDto } from './package.dto';
import { Expose } from 'class-transformer';

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

  @IsEnum(VehicleType)
  selectedVehicleType: VehicleType;
}

export class UpdateBookingRequestDto {
  @ValidateNested()
  @Type(() => CreateBookingAddressDto)
  @IsOptional()
  pickupAddress?: CreateBookingAddressDto;

  @ValidateNested()
  @Type(() => CreateBookingAddressDto)
  @IsOptional()
  dropAddress?: CreateBookingAddressDto;

  @ValidateNested()
  @Type(() => PackageDetailsDto)
  @IsOptional()
  package?: PackageDetailsDto;
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
  estimatedCost: number;
  @Expose()
  finalCost: number | null;
  @Expose()
  distanceKm: number;
  @Expose()
  baseFare: number;
  @Expose()
  distanceCharge: number;
  @Expose()
  weightMultiplier: number;
  @Expose()
  vehicleMultiplier: number;
  @Expose()
  suggestedVehicleType: $Enums.VehicleType;
  @Expose()
  status: $Enums.BookingStatus;
  @Expose()
  assignedDriverId: string | null;
  @Expose()
  @Type(() => DriverResponseDto)
  assignedDriver: DriverResponseDto | null;
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
  rzpOrderId: string | null;
  @Expose()
  rzpPaymentId: string | null;
  @Expose()
  rzpPaymentUrl: string | null;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  scheduledAt: Date | null;
}
