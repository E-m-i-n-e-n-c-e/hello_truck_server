import { FieldPhotoType, VerificationRequestStatus } from '@prisma/client';

export const DOCUMENT_FIELDS = ['license', 'rcBook', 'fc', 'insurance', 'aadhar', 'selfie'] as const;
export type DocumentField = typeof DOCUMENT_FIELDS[number];

export const ACTIVE_VERIFICATION_REQUEST_STATUSES: VerificationRequestStatus[] = [
  VerificationRequestStatus.PENDING,
  VerificationRequestStatus.IN_REVIEW,
  VerificationRequestStatus.APPROVED,
  VerificationRequestStatus.REVERT_REQUESTED,
  VerificationRequestStatus.REVERTED,
];

export const REQUIRED_FIELD_PHOTO_TYPES: FieldPhotoType[] = [
  FieldPhotoType.VEHICLE_FRONT,
  FieldPhotoType.VEHICLE_BACK,
  FieldPhotoType.VEHICLE_LEFT,
  FieldPhotoType.VEHICLE_RIGHT,
  FieldPhotoType.DRIVER_WITH_VEHICLE,
  FieldPhotoType.CHASSIS_NUMBER,
];
