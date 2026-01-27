import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectRefundDto {
  @ApiProperty({ description: 'Reason for rejection (min 10 chars)' })
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  reason: string;
}
