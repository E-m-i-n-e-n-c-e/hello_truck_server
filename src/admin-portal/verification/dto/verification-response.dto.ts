import { Expose, Type } from 'class-transformer';
import { DriverVerificationType, VerificationRequestStatus, VerificationStatus, AdminRole, DocumentActionType } from '@prisma/client';

/**
 * Admin user info (nested in responses)
 */
export class AdminUserInfoDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  role: AdminRole;

  @Expose()
  email?: string;
}

/**
 * Driver basic info (nested in responses)
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
  verificationStatus: VerificationStatus;
}

/**
 * Document action info (nested in verification details)
 */
export class DocumentActionDto {
  @Expose()
  id: string;

  @Expose()
  documentField: string;

  @Expose()
  action: DocumentActionType;

  @Expose()
  rejectionReason: string | null;

  @Expose()
  actionAt: Date;

  @Expose()
  @Type(() => AdminUserInfoDto)
  actionBy: AdminUserInfoDto;
}

/**
 * Verification action info (driver-level actions)
 */
export class VerificationActionDto {
  @Expose()
  id: string;

  @Expose()
  verificationRequestId: string;

  @Expose()
  actionType: string; // APPROVED, REJECTED, REVERT_REQUESTED, REVERT_APPROVED, REVERT_REJECTED

  @Expose()
  reason: string | null;

  @Expose()
  actionAt: Date;

  @Expose()
  @Type(() => AdminUserInfoDto)
  actionBy: AdminUserInfoDto;
}

/**
 * Field photo info (nested in verification details)
 */
export class FieldPhotoDto {
  @Expose()
  id: string;

  @Expose()
  verificationRequestId: string;

  @Expose()
  photoType: string;

  @Expose()
  url: string;

  @Expose()
  uploadedById: string;

  @Expose()
  uploadedAt: Date;
}

/**
 * Verification request (used in list and detail responses)
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
  @Type(() => AdminUserInfoDto)
  assignedTo: AdminUserInfoDto | null;

  @Expose()
  approvedById: string | null;

  @Expose()
  @Type(() => AdminUserInfoDto)
  approvedBy?: AdminUserInfoDto | null;

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
  @Type(() => DocumentActionDto)
  documentActions?: DocumentActionDto[];

  @Expose()
  @Type(() => VerificationActionDto)
  verificationActions?: VerificationActionDto[];

  @Expose()
  @Type(() => FieldPhotoDto)
  fieldPhotos?: FieldPhotoDto[];
}

/**
 * Pagination info
 */
export class PaginationDto {
  @Expose()
  page: number;

  @Expose()
  limit: number;

  @Expose()
  total: number;

  @Expose()
  totalPages: number;
}

/**
 * Driver documents (nested in driver details)
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
 * Vehicle owner (nested in vehicle)
 */
export class VehicleOwnerDto {
  @Expose()
  id: string;

  @Expose()
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

/**
 * Vehicle info (nested in driver details)
 */
export class VehicleDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  vehicleNumber: string;

  @Expose()
  vehicleType: string;

  @Expose()
  vehicleBodyLength: any; // Prisma.Decimal

  @Expose()
  vehicleBodyType: string;

  @Expose()
  fuelType: string;

  @Expose()
  vehicleImageUrl: string;

  @Expose()
  vehicleModelName: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => VehicleOwnerDto)
  owner: VehicleOwnerDto | null;
}

/**
 * Address info (nested in driver details)
 */
export class AddressDto {
  @Expose()
  id: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
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
  latitude: any | null; // Prisma.Decimal

  @Expose()
  longitude: any | null; // Prisma.Decimal
}

/**
 * Full driver details (used in driver detail responses)
 */
export class DriverDetailDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  phoneNumber: string;

  @Expose()
  verificationStatus: VerificationStatus;

  @Expose()
  profileCreatedAt: Date | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  photo: string | null;

  @Expose()
  @Type(() => DriverDocumentsDto)
  documents: DriverDocumentsDto | null;

  @Expose()
  @Type(() => VehicleDto)
  vehicle: VehicleDto | null;

  @Expose()
  @Type(() => AddressDto)
  address: AddressDto | null;

  @Expose()
  @Type(() => VerificationRequestDto)
  verificationRequests: VerificationRequestDto[];
}

/**
 * Response: List pending drivers (NEW drivers)
 * GET /admin-api/verifications/pending-drivers
 */
export class ListPendingDriversResponseDto {
  @Expose()
  @Type(() => DriverDetailDto)
  drivers: DriverDetailDto[];

  @Expose()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

/**
 * Response: List drivers with pending documents (RE-VERIFICATION)
 * GET /admin-api/verifications/pending-documents
 */
export class ListPendingDocumentsResponseDto {
  @Expose()
  @Type(() => DriverDetailDto)
  drivers: DriverDetailDto[];

  @Expose()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

/**
 * Response: List verifications
 * GET /admin-api/verifications
 * GET /admin-api/verifications/my-assignments
 */
export class ListVerificationsResponseDto {
  @Expose()
  @Type(() => VerificationRequestDto)
  verifications: VerificationRequestDto[];

  @Expose()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}

/**
 * Response: Get driver for verification
 * GET /admin-api/verifications/drivers/:driverId/details
 */
export class GetDriverForVerificationResponseDto extends DriverDetailDto {}

/**
/**
 * Response: Assign verification
 * PATCH /admin-api/verifications/:id/assign
 */
export class AssignVerificationResponseDto {
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
  @Type(() => AdminUserInfoDto)
  assignedTo: AdminUserInfoDto | null;

  @Expose()
  updatedAt: Date;
}

/**
 * Response: Document action
 * POST /admin-api/verifications/:id/documents/:field/action
 */
export class DocumentActionResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  message: string;
}

/**
 * Response: Approve verification
 * POST /admin-api/verifications/:id/approve
 */
export class ApproveVerificationResponseDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  status: VerificationRequestStatus;

  @Expose()
  approvedById: string | null;

  @Expose()
  approvedAt: Date | null;

  @Expose()
  bufferExpiresAt: Date | null;

  @Expose()
  bufferDurationMinutes: number;

  @Expose()
  updatedAt: Date;
}

/**
 * Response: Reject verification
 * POST /admin-api/verifications/:id/reject
 */
export class RejectVerificationResponseDto {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  status: VerificationRequestStatus;

  @Expose()
  revertReason: string | null;

  @Expose()
  updatedAt: Date;
}

/**
 * Response: Request revert
 * POST /admin-api/verifications/:id/revert-request
 */
export class RevertRequestResponseDto {
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
 * Response: Handle revert decision
 * POST /admin-api/verifications/:id/revert-decision
 */
export class RevertDecisionResponseDto {
  @Expose()
  success: boolean;

  @Expose()
  message: string;
}
