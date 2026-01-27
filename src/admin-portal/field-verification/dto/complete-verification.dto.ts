import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteVerificationDto {
  @ApiProperty({ description: 'Notes from field verification (optional)' })
  @IsString()
  @IsOptional()
  notes?: string;
}
