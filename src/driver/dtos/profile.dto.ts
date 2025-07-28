import { $Enums, Driver } from "@prisma/client";
import { Expose, Type } from "class-transformer";
import { IsOptional, IsPhoneNumber, IsString, IsUrl, ValidateNested } from "class-validator";
import { CreateDriverDocumentsDto } from "./documents.dto";
import { ToBoolean } from "src/common/decorators/to-boolean.decorator";

export class GetQueryDto {
  @ToBoolean()
  @IsOptional()
  includeDocuments?: boolean;
}

export class CreateDriverProfileDto {
  @IsString()
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
}

export class ProfileResponseDto implements Driver {
  id: string;
  isActive: boolean;

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
}

