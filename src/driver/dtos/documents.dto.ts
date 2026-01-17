import { DriverDocuments, VerificationStatus } from "@prisma/client";
import { Expose } from "class-transformer";
import { IsOptional, IsString, IsUrl, Matches, IsDateString } from "class-validator";

export class CreateDriverDocumentsDto {
  @IsString()
  @IsUrl()
  licenseUrl: string;

  @IsString()
  @IsUrl()
  rcBookUrl: string;

  @IsString()
  @IsUrl()
  fcUrl: string;

  @IsString()
  @IsUrl()
  insuranceUrl: string;

  @IsString()
  @IsUrl()
  aadharUrl: string;

  @IsString()
  @Matches(/^[0-9]{12}$/, {
    message: 'Aadhaar number must be 12 digits'
  })
  aadharNumber: string;

  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN number must be in format: ABCDE1234F'
  })
  panNumber: string;

  @IsString()
  @IsUrl()
  ebBillUrl: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  selfieUrl?: string;

  // Suggested expiry dates from driver (optional, ISO 8601 strings)
  @IsOptional()
  @IsDateString()
  suggestedLicenseExpiry?: string;

  @IsOptional()
  @IsDateString()
  suggestedRcBookExpiry?: string;

  @IsOptional()
  @IsDateString()
  suggestedFcExpiry?: string;

  @IsOptional()
  @IsDateString()
  suggestedInsuranceExpiry?: string;
}

export class UpdateDriverDocumentsDto {
  @IsString()
  @IsOptional()
  @IsUrl()
  licenseUrl?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  rcBookUrl?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  fcUrl?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  insuranceUrl?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  aadharUrl?: string;


  @IsString()
  @IsOptional()
  @IsUrl()
  ebBillUrl?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  selfieUrl?: string;

  // Suggested expiry dates from driver (optional, ISO 8601 strings)
  @IsOptional()
  @IsDateString()
  suggestedLicenseExpiry?: string;

  @IsOptional()
  @IsDateString()
  suggestedRcBookExpiry?: string;

  @IsOptional()
  @IsDateString()
  suggestedFcExpiry?: string;

  @IsOptional()
  @IsDateString()
  suggestedInsuranceExpiry?: string;
}

export class DriverDocumentsResponseDto implements DriverDocuments {
  id: string;
  driverId: string;

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
  aadharNumberHash: string;
  @Expose()
  panNumber: string;
  @Expose()
  ebBillUrl: string;
  @Expose()
  selfieUrl: string | null;
  @Expose()
  createdAt: Date;
  @Expose()
  updatedAt: Date;
}

export class ValidateAadharDto {
  @IsString()
  @Matches(/^[0-9]{12}$/, {
    message: 'Aadhaar number must be 12 digits'
  })
  aadharNumber: string;
}

export class ValidatePanDto {
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN number must be in format: ABCDE1234F'
  })
  panNumber: string;
}

export class DocumentValidationResponseDto {
  @Expose()
  isAvailable: boolean;
}
