import { Vehicle, VehicleOwner, VehicleType, VehicleBodyType, FuelType } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsOptional, IsString, IsUrl, IsEnum, IsNumber, IsDecimal, ValidateNested, IsPositive, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import { Decimal } from "@prisma/client/runtime/library";
import { CreateVehicleOwnerDto, VehicleOwnerResponseDto } from "./vehicle-owner.dto";

export class CreateVehicleDto implements Partial<Vehicle> {
  @IsString()
  vehicleNumber: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsNumber()
  @IsPositive()
  @Transform(({ value }) => parseFloat(value))
  vehicleBodyLength: Decimal;

  @IsEnum(VehicleBodyType)
  vehicleBodyType: VehicleBodyType;

  @IsEnum(FuelType)
  fuelType: FuelType;

  @IsString()
  @IsUrl()
  vehicleImageUrl: string;

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
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  vehicleBodyLength?: Decimal;

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
  vehicleImageUrl: string;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  @Type(() => VehicleOwnerResponseDto)
  owner: VehicleOwnerResponseDto | null;
}