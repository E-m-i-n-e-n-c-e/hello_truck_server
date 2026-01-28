import { Expose, Type } from 'class-transformer';
import { DriverVerificationType, VerificationRequestStatus, VerificationStatus, AdminRole, FieldPhotoType } from '@prisma/client';

/**
 * Driver basic info (nested)
 */
export class DriverBasicInfoDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  phoneNumber: string;

  @Expose()
  email: string | null;
}

/**
 * Admin user info (nested)
 */
export class AdminUserInfoDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;
}

/**
 * Field photo info (nested)
 */
export class FieldPhotoDto {
  @Expose()
  id: string;

  @Expose()
  verificationRequestId: string;

  @Expose()
  photoType: FieldPhotoType;

  @Expose()
  url: string;

  @Expose()
  uploadedById: string;

  @Expose()
  uploadedAt: Date;
}

/**
 * Driver documents (nested)
 */
export class DriverDocumentsDto {
  @Expose()
  id: string;

  @Expose()
  licenseUrl: string;

  @Expose()
  licenseStatus: VerificationStatus;

  @Expose()
  licenseExpiry: Date | null;

  @Expose()
  rcBookUrl: string;

  @Expose()
  rcBookStatus: VerificationStatus;

  @Expose()
  rcBookExpiry: Date | null;

  @Expose()
  fcUrl: string;

  @Expose()
  fcStatus: VerificationStatus;

  @Expose()
  fcExpiry: Date | null;

  @Expose()
  insuranceUrl: string;

  @Expose()
  insuranceStatus: VerificationStatus;

  @Expose()
  insuranceExpiry: Date | null;

  @Expose()
  aadharUrl: string;

  @Expose()
  selfieUrl: string | null;

  @Expose()
  panNumber: string;

  @Expose()
  ebBillUrl: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  driverId: string;

  @Expose()
  suggestedFcExpiry: Date | null;

  @Expose()
  suggestedInsuranceExpiry: Date | null;

  @Expose()
  suggestedLicenseExpiry: Date | null;

  @Expose()
  suggestedRcBookExpiry: Date | null;

  @Expose()
  aadharNumberEncrypted: string;

  @Expose()
  aadharNumberHash: string;
}

/**
 * Driver with documents (nested)
 */
export class DriverWithDocumentsDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  phoneNumber: string;

  @Expose()
  email: string | null;

  @Expose()
  verificationStatus: VerificationStatus;

  @Expose()
  @Type(() => DriverDocumentsDto)
  documents: DriverDocumentsDto | null;
}

/**
 * Verification request (nested)
 */
export class VerificationRequestDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  verificationType: DriverVerificationType;

  @Expose()
  status: VerificationRequestStatus;

  @Expose()
  ticketId: string | null;

  @Expose()
  reVerificationReason: string | null;

  @Expose()
  assignedToId: string | null;

  @Expose()
  approvedById: string | null;

  @Expose()
  approvedAt: Date | null;

  @Expose()
  bufferExpiresAt: Date | null;

  @Expose()
  revertReason: string | null;

  @Expose()
  revertRequestedById: string | null;

  @Expose()
  revertRequestedAt: Date | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => DriverBasicInfoDto)
  driver?: DriverBasicInfoDto;

  @Expose()
  @Type(() => AdminUserInfoDto)
  assignedTo?: AdminUserInfoDto | null;

  @Expose()
  @Type(() => FieldPhotoDto)
  fieldPhotos?: FieldPhotoDto[];
}

/**
 * Response: Get assigned verifications
 * GET /admin-api/field-verification/assigned
 */
export class GetAssignedVerificationsResponseDto {
  @Expose()
  @Type(() => VerificationRequestDto)
  verifications: VerificationRequestDto[];
}

/**
 * Response: Get verification details
 * GET /admin-api/field-verification/:id
 */
export class GetVerificationDetailsResponseDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  verificationType: DriverVerificationType;

  @Expose()
  status: VerificationRequestStatus;

  @Expose()
  ticketId: string | null;

  @Expose()
  reVerificationReason: string | null;

  @Expose()
  assignedToId: string | null;

  @Expose()
  approvedById: string | null;

  @Expose()
  approvedAt: Date | null;

  @Expose()
  bufferExpiresAt: Date | null;

  @Expose()
  revertReason: string | null;

  @Expose()
  revertRequestedById: string | null;

  @Expose()
  revertRequestedAt: Date | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => DriverWithDocumentsDto)
  driver: DriverWithDocumentsDto;

  @Expose()
  @Type(() => AdminUserInfoDto)
  assignedTo: AdminUserInfoDto | null;

  @Expose()
  @Type(() => FieldPhotoDto)
  fieldPhotos: FieldPhotoDto[];
}

/**
 * Response: Get driver documents
 * GET /admin-api/field-verification/:id/documents
 */
export class GetDriverDocumentsResponseDto {
  @Expose()
  verificationId: string;

  @Expose()
  driverId: string;

  @Expose()
  @Type(() => DriverDocumentsDto)
  documents: DriverDocumentsDto | null;
}

/**
 * Response: Upload photos
 * POST /admin-api/field-verification/:id/photos
 */
export class UploadPhotosResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  photosUploaded: number;
}

/**
 * Response: Complete verification
 * POST /admin-api/field-verification/:id/complete
 */
export class CompleteVerificationResponseDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  verificationType: DriverVerificationType;

  @Expose()
  status: VerificationRequestStatus;

  @Expose()
  assignedToId: string | null;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => DriverBasicInfoDto)
  driver: DriverBasicInfoDto;
}

/**
 * Response: Request revert
 * POST /admin-api/field-verification/:id/revert
 */
export class RevertResponseDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  status: VerificationRequestStatus;

  @Expose()
  revertReason: string | null;

  @Expose()
  revertRequestedById: string | null;

  @Expose()
  revertRequestedAt: Date | null;

  @Expose()
  updatedAt: Date;
}

/**
 * Response: Get signed upload URL
 * POST /admin-api/field-verification/:id/photos/signed-url
 */
export class GetSignedUrlResponseDto {
  @Expose()
  signedUrl: string;

  @Expose()
  publicUrl: string;

  @Expose()
  token: string;

  @Expose()
  filePath: string;

  @Expose()
  expiresIn: number;
}
