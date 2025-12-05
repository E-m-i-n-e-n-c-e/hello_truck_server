import { Driver, DriverStatus, VerificationStatus, VehicleOwner, Vehicle, VehicleType, VehicleBodyType, FuelType, DriverDocuments, DriverAddress } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { Decimal } from "@prisma/client/runtime/library";
import { IsOptional } from "class-validator";

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

export class DriverDocumentsResponseDto implements DriverDocuments {
  id: string;
  driverId: string;

  @Expose()
  licenseUrl: string;
  @Expose()
  licenseExpiry: Date | null;
  @Expose()
  licenseStatus: VerificationStatus;

  @Expose()
  rcBookUrl: string;

  @Expose()
  fcUrl: string;
  @Expose()
  fcExpiry: Date | null;
  @Expose()
  fcStatus: VerificationStatus;

  @Expose()
  insuranceUrl: string;
  @Expose()
  insuranceExpiry: Date | null;
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

export class DriverAddressResponseDto implements DriverAddress {
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
  latitude: Decimal | null;
  @Expose()
  longitude: Decimal | null;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}

export class DriverResponseDto implements Driver {
  walletBalance: Decimal;
  id: string;
  isActive: boolean;
  contactId: string | null;
  fundAccountId: string | null;
  latitude: Decimal | null;
  longitude: Decimal | null;

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
  referalCode: string | null;
  @Expose()
  photo: string | null;
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
  @Type(() => DriverDocumentsResponseDto)
  documents: DriverDocumentsResponseDto | null;
  @Expose()
  @Type(() => VehicleResponseDto)
  vehicle: VehicleResponseDto | null;
  @Expose()
  @Type(() => DriverAddressResponseDto)
  address: DriverAddressResponseDto | null;
  @Expose()
  score: number;
}

export class AdminDriverListResponseDto {
  data: DriverResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class UpdateDriverVerificationDto {
  @Expose()
  status: VerificationStatus;

  @Expose()
  @IsOptional()
  licenseExpiry?: string;

  @Expose()
  @IsOptional()
  fcExpiry?: string;

  @Expose()
  @IsOptional()
  insuranceExpiry?: string;
}
