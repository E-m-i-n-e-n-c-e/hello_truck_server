import { DriverDocuments } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsDate, IsOptional, IsString, IsUrl, Matches } from "class-validator";

export class CreateDriverDocumentsDto {
  @IsString()
  @IsUrl()
  licenseUrl: string;

  @Type(() => Date)
  @IsDate()
  licenseExpiry: Date;

  @IsString()
  @IsUrl()
  rcBookUrl: string;

  @IsString()
  @IsUrl()
  fcUrl: string;

  @Type(() => Date)
  @IsDate()
  fcExpiry: Date;

  @IsString()
  @IsUrl()
  insuranceUrl: string;

  @Type(() => Date)
  @IsDate()
  insuranceExpiry: Date;

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

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  licenseExpiry?: Date;

  @IsString()
  @IsOptional()
  @IsUrl()
  rcBookUrl?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  fcUrl?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  fcExpiry?: Date;

  @IsString()
  @IsOptional()
  @IsUrl()
  insuranceUrl?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  insuranceExpiry?: Date;

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
  licenseExpiry: Date;
  @Expose()
  rcBookUrl: string;
  @Expose()
  fcUrl: string;
  @Expose()
  fcExpiry: Date;
  @Expose()
  insuranceUrl: string;
  @Expose()
  insuranceExpiry: Date;
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

export class ExpiryAlertsResponseDto {
  @Expose()
  licenseAlert?: string;
  @Expose()
  insuranceAlert?: string;
}
