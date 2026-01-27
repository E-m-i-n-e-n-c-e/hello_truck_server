import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerificationRevertDecisionDto {
  @ApiProperty({ description: 'true to approve revert, false to reject' })
  @IsBoolean()
  approve: boolean;
}
