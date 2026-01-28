import { IsString, IsArray, ValidateNested, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Photo DTO for upload
 */
export class PhotoDto {
  @ApiProperty({
    enum: ['VEHICLE_FRONT', 'VEHICLE_BACK', 'VEHICLE_LEFT', 'VEHICLE_RIGHT', 'DRIVER_WITH_VEHICLE', 'CHASSIS_NUMBER'],
    description: 'Type of field verification photo'
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'URL of uploaded photo' })
  @IsString()
  url: string;
}

/**
 * Upload field verification photos
 * POST /admin-api/field-verification/:id/photos
 */
export class UploadPhotosRequestDto {
  @ApiProperty({ description: 'Verification ID (set from path param)' })
  @IsString()
  @IsOptional()
  verificationId?: string;

  @ApiProperty({ type: [PhotoDto], description: 'Array of photos to upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos: PhotoDto[];

  @ApiProperty({ description: 'Allow partial upload (not all photo types required)', default: false })
  @IsBoolean()
  @IsOptional()
  partialUpload?: boolean = false;
}

/**
 * Complete field verification
 * POST /admin-api/field-verification/:id/complete
 */
export class CompleteVerificationRequestDto {
  @ApiProperty({ description: 'Notes from field verification (optional)' })
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Request revert for field verification
 * POST /admin-api/field-verification/:id/revert
 */
export class RevertRequestDto {
  @ApiProperty({ description: 'Reason for revert request (min 10 chars)' })
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  reason: string;
}

/**
 * Get signed URL for photo upload
 * POST /admin-api/field-verification/:id/photos/signed-url
 */
export class GetSignedUrlRequestDto {
  @ApiProperty({ description: 'Type of photo being uploaded' })
  @IsString()
  photoType: string;

  @ApiProperty({ description: 'Content type (e.g., image/jpeg, image/png)' })
  @IsString()
  contentType: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  fileName: string;
}
