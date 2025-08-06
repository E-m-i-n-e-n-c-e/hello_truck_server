import { Vehicle, VehicleOwner, VehicleType, VehicleBodyType, FuelType } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsOptional, IsString, IsUrl, IsEnum, IsNumber, IsDecimal, ValidateNested, IsPositive, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import { Decimal } from "@prisma/client/runtime/library";

export class CreateVehicleOwnerDto {
  @IsString()
  name: string;

  @IsString()
  aadharNumber: string;

  @IsString()
  contactNumber: string;

  @IsString()
  addressLine1: string;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  pincode: string;

  @IsString()
  city: string;

  @IsString()
  district: string;

  @IsString()
  state: string;
}

export class UpdateVehicleOwnerDto implements Partial<CreateVehicleOwnerDto> {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  aadharNumber?: string;

  @IsString()
  @IsOptional()
  contactNumber?: string;

  @IsString()
  @IsOptional()
  addressLine1?: string;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  @IsOptional()
  pincode?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  state?: string;
}

export class CreateVehicleDto {
  @IsString()
  vehicleNumber: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsNumber()
  @IsPositive()
  @Max(8.0)
  @Min(7.0)
  @Transform(({ value }) => parseFloat(value))
  vehicleBodyLength: number;

  @IsEnum(VehicleBodyType)
  vehicleBodyType: VehicleBodyType;

  @IsEnum(FuelType)
  fuelType: FuelType;

  @IsString()
  @IsOptional()
  @IsUrl()
  vehicleImageUrl?: string;

  @ValidateNested()
  @Type(() => CreateVehicleOwnerDto)
  @IsOptional()
  owner?: CreateVehicleOwnerDto;
}

export class UpdateVehicleDto implements Partial<CreateVehicleDto> {
  @IsString()
  @IsOptional()
  vehicleNumber?: string;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsNumber()
  @IsPositive()
  @Max(8.0)
  @Min(7.0)
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  vehicleBodyLength?: number;

  @IsEnum(VehicleBodyType)
  @IsOptional()
  vehicleBodyType?: VehicleBodyType;

  @IsEnum(FuelType)
  @IsOptional()
  fuelType?: FuelType;

  @IsString()
  @IsOptional()
  @IsUrl()
  vehicleImageUrl?: string;
}

export class VehicleResponseDto implements Vehicle {
  id: string;
  driverId: string;

  @Expose()
  vehicleNumber: string;
  @Expose()
  vehicleType: VehicleType;
  @Expose()
  vehicleBodyLength: Decimal;
  @Expose()
  vehicleBodyType: VehicleBodyType;
  @Expose()
  fuelType: FuelType;
  @Expose()
  vehicleImageUrl: string | null;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  owner: VehicleOwner | null;
}

export class VehicleOwnerResponseDto implements VehicleOwner {
  id: string;
  vehicleId: string;

  @Expose()
  name: string;
  @Expose()
  aadharNumber: string;
  @Expose()
  contactNumber: string;
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
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}