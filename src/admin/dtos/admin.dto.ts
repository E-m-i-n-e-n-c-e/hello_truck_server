import { DriverStatus, VerificationStatus, VehicleOwner, VehicleType, VehicleBodyType, FuelType, DriverDocuments, DriverAddress } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsOptional, IsEnum, IsNotEmpty } from "class-validator";

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

export class VehicleResponseDto {
  id: string;
  driverId: string;

  @Expose()
  vehicleNumber: string;
  @Expose()
  vehicleModelName: string;
  @Expose()
  vehicleType: VehicleType;
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

export class DriverDocumentsResponseDto implements DriverDocuments {
  id: string;
  driverId: string;

  @Expose()
  selfieUrl: string | null;

  @Expose()
  licenseUrl: string;
  @Expose()
  licenseExpiry: Date | null;
  @Expose()
  suggestedLicenseExpiry: Date | null;
  @Expose()
  licenseStatus: VerificationStatus;

  @Expose()
  rcBookUrl: string;
  @Expose()
  rcBookExpiry: Date | null;
  @Expose()
  suggestedRcBookExpiry: Date | null;
  @Expose()
  rcBookStatus: VerificationStatus;

  @Expose()
  fcUrl: string;
  @Expose()
  fcExpiry: Date | null;
  @Expose()
  suggestedFcExpiry: Date | null;
  @Expose()
  fcStatus: VerificationStatus;

  @Expose()
  insuranceUrl: string;
  @Expose()
  insuranceExpiry: Date | null;
  @Expose()
  suggestedInsuranceExpiry: Date | null;
  @Expose()
  insuranceStatus: VerificationStatus;

  @Expose()
  aadharUrl: string;
  @Expose()
  panNumber: string;
  @Expose()
  ebBillUrl: string;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}

export class DriverAddressResponseDto {
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

export class DriverResponseDto {
  @Expose()
  id: string;
  @Expose()
  contactId: string | null;
  @Expose()
  fundAccountId: string | null;
  @Expose()
  payoutMethod: string | null;
  @Expose()
  phoneNumber: string;
  @Expose()
  firstName: string | null;
  @Expose()
  lastName: string | null;
  @Expose()
  email: string | null;
  @Expose()
  alternatePhone: string | null;
  @Expose()
  photo: string | null;
  @Expose()
  referalCode: string | null;
  @Expose()
  latitude: number | null;
  @Expose()
  longitude: number | null;
  @Expose()
  walletBalance: number;
  @Expose()
  isActive: boolean;
  @Expose()
  verificationStatus: VerificationStatus;
  @Expose()
  driverStatus: DriverStatus;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  lastSeenAt: Date | null;
  @Expose()
  score: number;
  @Expose()
  @Type(() => DriverDocumentsResponseDto)
  documents: DriverDocumentsResponseDto | null;
  @Expose()
  @Type(() => VehicleResponseDto)
  vehicle: VehicleResponseDto | null;
  @Expose()
  @Type(() => DriverAddressResponseDto)
  address: DriverAddressResponseDto | null;
}

export class MetaDto {
  @Expose()
  total: number;
  @Expose()
  page: number;
  @Expose()
  limit: number;
  @Expose()
  totalPages: number;
}

export class AdminDriverListResponseDto {
  @Expose()
  @Type(() => DriverResponseDto)
  data: DriverResponseDto[];

  @Expose()
  @Type(() => MetaDto)
  meta: MetaDto;
}

export class UpdateDriverVerificationDto {
  @IsEnum(VerificationStatus)
  @IsNotEmpty()
  status: VerificationStatus;

  @IsOptional()
  licenseExpiry?: string;

  @IsOptional()
  fcExpiry?: string;

  @IsOptional()
  insuranceExpiry?: string;

  @IsOptional()
  rcBookExpiry?: string;
}
