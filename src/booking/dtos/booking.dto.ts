import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { $Enums, VehicleType } from '@prisma/client';
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

export class BookingResponseDto {
  @Expose()
  id: string;
  @Expose()
  pickupAddress: BookingAddressResponseDto;
  @Expose()
  dropAddress: BookingAddressResponseDto;
  @Expose()
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
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  scheduledAt: Date | null;
}
