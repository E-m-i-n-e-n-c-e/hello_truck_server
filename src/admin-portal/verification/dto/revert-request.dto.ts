import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerificationRevertRequestDto {
  @ApiProperty({ description: 'Reason for requesting revert (min 10 chars)' })
  @IsString()
  @MinLength(10, { message: 'Revert reason must be at least 10 characters' })
  reason: string;
}
