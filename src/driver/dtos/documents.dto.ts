import { DriverDocuments, VerificationStatus } from "@prisma/client";
import { Expose } from "class-transformer";
import { IsOptional, IsString, IsUrl, Matches } from "class-validator";

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
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN number must be in format: ABCDE1234F'
  })
  panNumber: string;

  @IsString()
  @IsUrl()
  ebBillUrl: string;
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
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN number must be in format: ABCDE1234F'
  })
  panNumber?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  ebBillUrl?: string;
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
