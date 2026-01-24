import {
  Driver,
  DriverStatus,
  DriverStatusLog,
  Vehicle,
  VerificationStatus,
} from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import {
  CreateDriverDocumentsDto,
  DriverDocumentsResponseDto,
} from './documents.dto';
import { CreateVehicleDto, VehicleResponseDto } from './vehicle.dto';
import { ToBoolean } from 'src/common/decorators/to-boolean.decorator';
import { CreateDriverAddressDto } from './address.dto';
import {
  CreatePayoutDetailsDto,
  UpdatePayoutDetailsDto,
} from 'src/razorpay/dtos/payout-details.dto';
import { Decimal } from '@prisma/client/runtime/library';

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
  appliedReferralCode?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  photo?: string; // Firebase Storage URL

  @ValidateNested()
  @Type(() => CreateDriverDocumentsDto)
  documents: CreateDriverDocumentsDto;

  @ValidateNested()
  @Type(() => CreateDriverAddressDto)
  @IsOptional()
  address: CreateDriverAddressDto;

  @ValidateNested()
  @Type(() => CreateVehicleDto)
  @IsOptional()
  vehicle: CreateVehicleDto;

  @ValidateNested()
  @Type(() => CreatePayoutDetailsDto)
  @IsOptional()
  payoutDetails: CreatePayoutDetailsDto;
}

export class UpdateDriverProfileDto implements Partial<Driver> {
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

export class ProfileResponseDto {
  @Expose()
  id: string;
  @Expose()
  isActive: boolean;
  @Expose()
  contactId: string | null;
  @Expose()
  fundAccountId: string | null;
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
  referralCode: string | null;
  @Expose()
  photo: string | null;
  @Expose()
  verificationStatus: VerificationStatus;
  @Expose()
  driverStatus: DriverStatus;
  @Expose()
  profileCreatedAt: Date | null;
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
  score: number;
  @Expose()
  rideCount: number;
  @Expose()
  walletBalance: number;
  @Expose()
  hasAppliedReferral: boolean;
}

export class UpdateDriverStatusDto implements Partial<DriverStatusLog> {
  @IsIn([DriverStatus.AVAILABLE, DriverStatus.UNAVAILABLE])
  status: DriverStatus;
}

export class UpdateLocationDto {
  @IsLatitude()
  latitude: Decimal;

  @IsLongitude()
  longitude: Decimal;
}
