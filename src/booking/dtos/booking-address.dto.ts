import { Address } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Expose } from "class-transformer";
import { IsLatitude, IsLongitude, IsString, IsOptional, IsNotEmpty } from "class-validator";

export class CreateBookingAddressDto {
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

export class BookingAddressResponseDto {
  @Expose()
  latitude: number;
  @Expose()
  longitude: number;
  @Expose()
  formattedAddress: string;
  @Expose()
  addressDetails: string | null;
}