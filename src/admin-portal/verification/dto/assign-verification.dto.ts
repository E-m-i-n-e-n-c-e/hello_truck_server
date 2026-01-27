import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignVerificationDto {
  @ApiProperty({ description: 'Admin user ID to assign the verification to' })
  @IsString()
  assignedToId: string;
}
