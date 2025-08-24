import { $Enums, Driver, DriverStatus, DriverStatusLog, Vehicle } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUrl, ValidateNested } from "class-validator";
import { CreateDriverDocumentsDto, DriverDocumentsResponseDto } from "./documents.dto";
import { CreateVehicleDto } from "./vehicle.dto";
import { ToBoolean } from "src/common/decorators/to-boolean.decorator";
import { CreateAddressDto } from "./address.dto";
import { CreatePayoutDetailsDto, UpdatePayoutDetailsDto } from "src/razorpay/dtos/payout-details.dto";
import { Decimal } from "@prisma/client/runtime/library";

export class GetQueryDto {
  @ToBoolean()
  @IsOptional()
  includeDocuments?: boolean;

  @ToBoolean()
  @IsOptional()
  includeVehicle?: boolean;
}

export class CreateDriverProfileDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  googleIdToken?: string; // For email verification

  @IsString()
  @IsOptional()
  @IsPhoneNumber('IN')
  alternatePhone?: string;

  @IsString()
  @IsOptional()
  referalCode?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  photo?: string; // Firebase Storage URL

  @ValidateNested()
  @Type(() => CreateDriverDocumentsDto)
  documents: CreateDriverDocumentsDto;

  @ValidateNested()
  @Type(() => CreateAddressDto)
  @IsOptional()
  address: CreateAddressDto;

  @ValidateNested()
  @Type(() => CreateVehicleDto)
  @IsOptional()
  vehicle: CreateVehicleDto;

  @ValidateNested()
  @Type(() => CreatePayoutDetailsDto)
  @IsOptional()
  payoutDetails: CreatePayoutDetailsDto;
}

export class UpdateProfileDto implements Partial<Driver> {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  googleIdToken?: string; // For email verification

  @IsString()
  @IsOptional()
  @IsPhoneNumber('IN')
  alternatePhone?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  photo?: string; // Firebase Storage URL

  @ValidateNested()
  @Type(() => UpdatePayoutDetailsDto)
  @IsOptional()
  payoutDetails?: UpdatePayoutDetailsDto;
}

export class ProfileResponseDto implements Driver {
  id: string;
  isActive: boolean;
  contactId: string | null;
  fundAccountId: string | null;
  driverStatus: $Enums.DriverStatus;
  latitude: Decimal | null;
  longitude: Decimal | null;
  lastSeenAt: Date | null;

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
  verificationStatus: $Enums.VerificationStatus;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
  @Expose()
  @Type(() => DriverDocumentsResponseDto)
  documents: DriverDocumentsResponseDto | null;
  @Expose()
  vehicle: Vehicle | null;
  @Expose()
  score: number;
}

export class UpdateDriverStatusDto implements Partial<DriverStatusLog> {
  @IsEnum(DriverStatus)
  status: DriverStatus;
}

export class UpdateLocationDto implements Partial<Driver> {
  @IsLatitude()
  latitude: Decimal;

  @IsLongitude()
  longitude: Decimal;
}