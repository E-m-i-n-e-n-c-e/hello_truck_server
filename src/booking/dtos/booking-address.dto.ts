import { Address } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Expose } from "class-transformer";
import { IsLatitude, IsLongitude, IsString, IsOptional, IsPhoneNumber } from "class-validator";

export class CreateBookingAddressDto {
  @IsString()
  @IsOptional()
  addressName?: string;

  @IsString()
  contactName: string;

  @IsString()
  contactPhone: string;

  @IsOptional()
  @IsString()
  noteToDriver?: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsString()
  @IsOptional()
  formattedAddress: string;

  @IsOptional()
  @IsString()
  addressDetails?: string;
}

export class UpdateBookingAddressDto {
  @IsString()
  @IsOptional()
  addressName?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  noteToDriver?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsString()
  @IsOptional()
  formattedAddress?: string;

  @IsOptional()
  @IsString()
  addressDetails?: string;
}

export class BookingAddressResponseDto {
  @Expose()
  addressName: string | null;
  @Expose()
  contactName: string | null;
  @Expose()
  contactPhone: string | null;
  @Expose()
  noteToDriver: string | null;
  @Expose()
  latitude: number;
  @Expose()
  longitude: number;
  @Expose()
  formattedAddress: string;
  @Expose()
  addressDetails: string | null;
}