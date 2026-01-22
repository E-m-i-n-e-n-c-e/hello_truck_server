import { VehicleOwner } from "@prisma/client";
import { Expose } from "class-transformer";
import { IsOptional, IsString, IsUrl } from "class-validator";

export class CreateVehicleOwnerDto implements Partial<VehicleOwner> {
  @IsString()
  name: string;

  @IsString()
  @IsUrl()
  aadharUrl: string;

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

export class UpdateVehicleOwnerDto implements Partial<VehicleOwner> {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  aadharUrl?: string;

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

export class VehicleOwnerResponseDto implements VehicleOwner {
  id: string;
  vehicleId: string;

  @Expose()
  name: string;
  @Expose()
  aadharUrl: string;
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

