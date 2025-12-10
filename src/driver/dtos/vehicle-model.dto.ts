import { Expose } from 'class-transformer';

export class VehicleModelResponseDto {
  @Expose()
  name: string;

  @Expose()
  perKm: number;

  @Expose()
  baseKm: number;

  @Expose()
  baseFare: number;

  @Expose()
  maxWeightTons: number;
}
