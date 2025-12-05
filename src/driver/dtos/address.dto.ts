import { IsString, IsOptional, IsLatitude, IsLongitude, Matches, Length } from 'class-validator';
import { Expose } from 'class-transformer';
import { DriverAddress } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateDriverAddressDto implements Partial<DriverAddress> {
  @IsString()
  addressLine1: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsString()
  @Length(6, 6, { message: 'Pincode must be exactly 6 characters' })
  @Matches(/^[0-9]{6}$/, { message: 'Invalid pincode format' })
  pincode: string;

  @IsString()
  city: string;

  @IsString()
  district: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsLatitude()
  latitude?: Decimal;

  @IsOptional()
  @IsLongitude()
  longitude?: Decimal;
}

export class UpdateDriverAddressDto implements Partial<DriverAddress> {
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'Pincode must be exactly 6 characters' })
  @Matches(/^[0-9]{6}$/, { message: 'Invalid pincode format' })
  pincode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: Decimal;

  @IsOptional()
  @IsLongitude()
  longitude?: Decimal;
}

export class AddressResponseDto {
  id: string;
  driverId: string;

  @Expose()
  addressLine1: string;
  @Expose()
  landmark: string | null;
  @Expose()
  pincode: string;
  @Expose()
  city: string;
  @Expose()
  district: string;
  @Expose()
  state: string;
  @Expose()
  latitude: number | null;
  @Expose()
  longitude: number | null;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}