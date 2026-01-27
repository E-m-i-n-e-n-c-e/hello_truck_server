import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentActionType } from '@prisma/client';

export class DocumentActionDto {
  @ApiProperty({ enum: DocumentActionType, description: 'APPROVED or REJECTED' })
  @IsEnum(DocumentActionType)
  action: DocumentActionType;

  @ApiProperty({ required: false, description: 'Required if action is REJECTED (min 10 chars)' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  rejectionReason?: string;
}
