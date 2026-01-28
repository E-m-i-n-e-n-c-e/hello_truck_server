import { IsString, IsEnum, IsOptional, MinLength, IsInt, Min, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DriverVerificationType, VerificationRequestStatus, DocumentActionType } from '@prisma/client';

/**
 * Create new verification request
 */
export class CreateVerificationRequestDto {
  @ApiProperty({ description: 'Driver ID to create verification for' })
  @IsString()
  driverId: string;

  @ApiProperty({ enum: DriverVerificationType, description: 'NEW_DRIVER or EXISTING_DRIVER' })
  @IsEnum(DriverVerificationType)
  verificationType: DriverVerificationType;

  @ApiProperty({ required: false, description: 'Required for EXISTING_DRIVER type' })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Re-verification reason must be at least 10 characters' })
  reVerificationReason?: string;
}

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

/**
 * Assign verification to agent
 */
export class AssignVerificationRequestDto {
  @ApiProperty({ description: 'Admin user ID to assign the verification to' })
  @IsString()
  assignedToId: string;
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
export class RevertRequestDto {
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
