import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PhotoDto {
  @ApiProperty({
    enum: ['VEHICLE_FRONT', 'VEHICLE_BACK', 'VEHICLE_LEFT', 'VEHICLE_RIGHT', 'DRIVER_WITH_VEHICLE', 'CHASSIS_NUMBER'],
    description: 'Type of field verification photo',
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'URL of uploaded photo' })
  @IsString()
  url: string;
}

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

  @ApiProperty({ description: 'Allow partial upload (single-photo replace/upload)', default: false })
  @IsBoolean()
  @IsOptional()
  partialUpload?: boolean = false;
}

export class GetSignedUrlRequestDto {
  @ApiProperty({ description: 'Type of photo being uploaded' })
  @IsString()
  photoType: string;

  @ApiProperty({ description: 'Content type (e.g. image/jpeg)' })
  @IsString()
  contentType: string;

  @ApiProperty({ description: 'Original file name' })
  @IsString()
  fileName: string;
}
