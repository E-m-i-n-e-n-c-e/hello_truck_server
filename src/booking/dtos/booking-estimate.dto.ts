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
  baseKm: number;

  @Expose()
  perKm: number;

  @Expose()
  distanceKm: number;

  @Expose()
  weightInTons: number;

  @Expose()
  effectiveBasePrice: number;
}

class VehicleOptionDto {
  @Expose()
  vehicleModelName: string;

  @Expose()
  estimatedCost: number;

  @Expose()
  maxWeightTons: number;

  @Expose()
  @Type(() => BreakdownDto)
  breakdown: BreakdownDto;
}

export class BookingEstimateResponseDto {
  @Expose()
  distanceKm: number;

  @Expose()
  idealVehicleModel: string;

  @Expose()
  @Type(() => VehicleOptionDto)
  topVehicles: VehicleOptionDto[];
}
