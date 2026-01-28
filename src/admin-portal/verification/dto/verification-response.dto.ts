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
 * Field photo info (nested in verification details)
 */
export class FieldPhotoDto {
  @Expose()
  id: string;

  @Expose()
  photoUrl: string;

  @Expose()
  uploadedAt: Date;

  @Expose()
  uploadedById: string;
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
  license: string | null;

  @Expose()
  licenseStatus: VerificationStatus;

  @Expose()
  licenseExpiry: Date | null;

  @Expose()
  rcBook: string | null;

  @Expose()
  rcBookStatus: VerificationStatus;

  @Expose()
  rcBookExpiry: Date | null;

  @Expose()
  fc: string | null;

  @Expose()
  fcStatus: VerificationStatus;

  @Expose()
  fcExpiry: Date | null;

  @Expose()
  insurance: string | null;

  @Expose()
  insuranceStatus: VerificationStatus;

  @Expose()
  insuranceExpiry: Date | null;

  @Expose()
  aadhar: string | null;

  @Expose()
  selfie: string | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  driverId: string;

  @Expose()
  licenseNumber: string | null;

  @Expose()
  rcNumber: string | null;

  @Expose()
  fcNumber: string | null;

  @Expose()
  insuranceNumber: string | null;

  @Expose()
  aadharNumber: string | null;

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
  name: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  relationship: string | null;
}

/**
 * Vehicle info (nested in driver details)
 */
export class VehicleDto {
  @Expose()
  id: string;

  @Expose()
  registrationNumber: string;

  @Expose()
  vehicleType: string;

  @Expose()
  make: string | null;

  @Expose()
  model: string | null;

  @Expose()
  year: number | null;

  @Expose()
  ownerId: string | null;

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
  updatedAt: Date;

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
 * Response: Get verification by ID
 * GET /admin-api/verifications/:id
 */
export class GetVerificationResponseDto {
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
  @Type(() => DriverDetailDto)
  driver: DriverDetailDto;

  @Expose()
  @Type(() => DocumentActionDto)
  documentActions: DocumentActionDto[];

  @Expose()
  @Type(() => FieldPhotoDto)
  fieldPhotos: FieldPhotoDto[];
}

/**
 * Response: Get driver for verification
 * GET /admin-api/verifications/drivers/:driverId/details
 */
export class GetDriverForVerificationResponseDto extends DriverDetailDto {}

/**
 * Response: Create verification
 * POST /admin-api/verifications
 */
export class CreateVerificationResponseDto {
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
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Type(() => DriverBasicInfoDto)
  driver: DriverBasicInfoDto;
}

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
