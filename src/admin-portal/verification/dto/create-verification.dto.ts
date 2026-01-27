import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DriverVerificationType } from '@prisma/client';

export class CreateVerificationDto {
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
