import { IsString, IsEnum, IsOptional, MinLength, IsInt, Min, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DriverVerificationType, VerificationRequestStatus, DocumentActionType, VerificationStatus } from '@prisma/client';
import { ToBoolean } from 'src/common/decorators/to-boolean.decorator';

/**
 * List verifications with filters
 */
export class ListVerificationsRequestDto {
  @ApiProperty({ enum: VerificationRequestStatus, required: false })
  @IsOptional()
  @IsEnum(VerificationRequestStatus)
  status?: VerificationRequestStatus;

  @ApiProperty({ enum: DriverVerificationType, required: false })
  @IsOptional()
  @IsEnum(DriverVerificationType)
  verificationType?: DriverVerificationType;

  @ApiProperty({ required: false, description: 'Filter by assigned agent ID' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiProperty({ required: false, description: 'Filter by driver ID' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ required: false, description: 'Start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, description: 'End date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, description: 'Search by driver name, phone number, or ticket ID' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Filter by driver verification status', enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  driverVerificationStatus?: VerificationStatus;

  @ApiProperty({ required: false, description: 'Filter by whether there is an active request' })
  @IsOptional()
  @ToBoolean()
  hasActiveRequest?: boolean;

  @ApiProperty({ required: false, description: 'Filter by whether request is assigned' })
  @IsOptional()
  @ToBoolean()
  isAssigned?: boolean;

  @ApiProperty({ required: false, description: 'Filter by whether driver has pending documents' })
  @IsOptional()
  @ToBoolean()
  hasPendingDocuments?: boolean;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class ListVerificationDriversRequestDto {
  @ApiProperty({ required: false, description: 'Search by driver name or phone number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  driverVerificationStatus?: VerificationStatus;

  @ApiProperty({ required: false, enum: VerificationRequestStatus })
  @IsOptional()
  @IsEnum(VerificationRequestStatus)
  requestStatus?: VerificationRequestStatus;

  @ApiProperty({ required: false, enum: DriverVerificationType })
  @IsOptional()
  @IsEnum(DriverVerificationType)
  verificationType?: DriverVerificationType;

  @ApiProperty({ required: false })
  @IsOptional()
  @ToBoolean()
  hasActiveRequest?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @ToBoolean()
  isAssigned?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @ToBoolean()
  hasPendingDocuments?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class CreateVerificationRequestDto {
  @ApiProperty({ description: 'Driver ID to create request for' })
  @IsString()
  driverId: string;
}

/**
 * Assign verification to agent
 */
export class AssignVerificationRequestDto {
  @ApiProperty({ description: 'Email of the admin/agent/field-agent to assign the verification to' })
  @IsString()
  email: string;
}

/**
 * Approve or reject a document
 */
export class DocumentActionRequestDto {
  @ApiProperty({ enum: DocumentActionType, description: 'APPROVED or REJECTED' })
  @IsEnum(DocumentActionType)
  action: DocumentActionType;

  @ApiProperty({ required: false, description: 'Required if action is REJECTED (min 10 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  rejectionReason?: string;

  @ApiProperty({ required: false, description: 'Expiry date for the document (ISO 8601 format)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

/**
 * Reject entire verification
 */
export class RejectVerificationRequestDto {
  @ApiProperty({ description: 'Reason for rejection (min 10 chars)' })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  reason: string;
}

/**
 * Request revert (within buffer window)
 */
export class VerificationRevertRequestDto {
  @ApiProperty({ description: 'Reason for requesting revert (min 10 chars)' })
  @IsString()
  @MinLength(10, { message: 'Revert reason must be at least 10 characters' })
  reason: string;
}

/**
 * Approve or reject revert request (Admin only)
 */
export class RevertDecisionRequestDto {
  @ApiProperty({ description: 'true to approve revert, false to reject' })
  @IsBoolean()
  approve: boolean;
}

export class RevertDocumentRejectionRequestDto {
  @ApiProperty({ required: false, description: 'Optional note for reverting document rejection' })
  @IsOptional()
  @IsString()
  note?: string;
}
