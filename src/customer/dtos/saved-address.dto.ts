import {
  IsString,
  IsOptional,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsPhoneNumber,
  Matches,
  Length,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { Address, SavedAddress } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// DTO for creating a new address
class CreateAddressDto implements Partial<Address> {
  @IsString()
  @IsNotEmpty()
  formattedAddress: string;

  @IsOptional()
  @IsString()
  addressDetails?: string;

  @IsLatitude()
  latitude: Decimal;

  @IsLongitude()
  longitude: Decimal;
}

// DTO for creating a saved address (links customer to address)
export class CreateSavedAddressDto implements Partial<SavedAddress> {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsPhoneNumber('IN')
  contactPhone: string;

  @IsOptional()
  @IsString()
  noteToDriver?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ValidateNested()
  @Type(() => CreateAddressDto)
  address: CreateAddressDto;
}

class UpdateAddressDto implements Partial<Address> {
  @IsOptional()
  @IsString()
  formattedAddress?: string;

  @IsOptional()
  @IsString()
  addressDetails?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: Decimal;

  @IsOptional()
  @IsLongitude()
  longitude?: Decimal;
}

// DTO for updating a saved address
export class UpdateSavedAddressDto implements Partial<SavedAddress> {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsPhoneNumber('IN')
  contactPhone?: string;

  @IsOptional()
  @IsString()
  noteToDriver?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  // Optional address updates
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAddressDto)
  address?: UpdateAddressDto;
}

class AddressResponseDto {
  @Expose()
  formattedAddress: string;
  @Expose()
  addressDetails: string | null;
  @Expose()
  latitude: number;
  @Expose()
  longitude: number;
}

// Response DTO for saved address with full address details
export class SavedAddressResponseDto implements SavedAddress {
  customerId: string;
  addressId: string;

  @Expose()
  id: string;
  @Expose()
  name: string;
  @Expose()
  @Type(() => AddressResponseDto)
  address: AddressResponseDto;
  @Expose()
  contactName: string;
  @Expose()
  contactPhone: string;
  @Expose()
  noteToDriver: string | null;
  @Expose()
  isDefault: boolean;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}
