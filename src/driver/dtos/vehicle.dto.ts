import { Vehicle, VehicleOwner, VehicleType, VehicleBodyType, FuelType } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsOptional, IsString, IsUrl, IsEnum, IsNumber, IsDecimal, ValidateNested, IsPositive, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import { Decimal } from "@prisma/client/runtime/library";
import { CreateVehicleOwnerDto, VehicleOwnerResponseDto } from "./vehicle-owner.dto";
import { VehicleModelResponseDto } from "./vehicle-model.dto";

export class CreateVehicleDto implements Partial<Vehicle> {
  @IsString()
  vehicleNumber: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsString()
  vehicleModelName: string;

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

  @IsString()
  @IsOptional()
  vehicleModelName?: string;

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

export class VehicleResponseDto {
  id: string;
  driverId: string;

  @Expose()
  vehicleNumber: string;
  @Expose()
  vehicleType: VehicleType;
  @Expose()
  vehicleModelName: string;
  @Expose()
  @Type(() => VehicleModelResponseDto)
  vehicleModel: VehicleModelResponseDto;
  @Expose()
  vehicleBodyLength: number;
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