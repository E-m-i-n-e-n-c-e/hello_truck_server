import { IsString, IsArray, ValidateNested, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

export class UploadPhotosDto {
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
