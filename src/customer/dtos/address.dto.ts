import { IsString, IsOptional, IsBoolean, IsLatitude, IsLongitude, IsPhoneNumber, Matches, Length } from 'class-validator';
import { Expose } from 'class-transformer';
import { CustomerAddress } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateAddressDto implements Partial<CustomerAddress> {
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

  @IsLatitude()
  latitude: Decimal;

  @IsLongitude()
  longitude: Decimal;

  @IsOptional()
  @IsPhoneNumber('IN')
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto implements Partial<CustomerAddress> {
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

  @IsOptional()
  @IsPhoneNumber('IN')
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class AddressResponseDto implements CustomerAddress {
  customerId: string;

  @Expose()
  id: string;
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
  latitude: Decimal;
  @Expose()
  longitude: Decimal;
  @Expose()
  phoneNumber: string | null;
  @Expose()
  label: string | null;
  @Expose()
  isDefault: boolean;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}