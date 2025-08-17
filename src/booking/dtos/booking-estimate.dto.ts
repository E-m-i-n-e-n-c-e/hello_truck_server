import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Expose } from 'class-transformer';
import { PackageDetailsDto } from './package.dto';
import { CreateBookingAddressDto } from './booking-address.dto';

export class BookingEstimateRequestDto {
  @ValidateNested()
  @Type(() => CreateBookingAddressDto)
  pickupAddress: CreateBookingAddressDto;

  @ValidateNested()
  @Type(() => CreateBookingAddressDto)
  dropAddress: CreateBookingAddressDto;

  @ValidateNested()
  @Type(() => PackageDetailsDto)
  packageDetails: PackageDetailsDto;
}

class BreakdownDto {
  @Expose()
  baseFare: number;

  @Expose()
  distanceCharge: number;

  @Expose()
  weightMultiplier: number;

  @Expose()
  vehicleMultiplier: number;

  @Expose()
  totalMultiplier: number;
}

class VehicleOptionDto {
  @Expose()
  vehicleType: string;

  @Expose()
  estimatedCost: number;

  @Expose()
  isAvailable: boolean;

  @Expose()
  weightLimit: number;

  @Expose()
  @Type(() => BreakdownDto)
  breakdown: BreakdownDto;
}

export class BookingEstimateResponseDto {
  @Expose()
  distanceKm: number;

  @Expose()
  suggestedVehicleType: string;

  @Expose()
  @Type(() => VehicleOptionDto)
  vehicleOptions: VehicleOptionDto[];
}
