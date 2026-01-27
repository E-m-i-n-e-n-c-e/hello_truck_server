import { IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({ example: 'NewPassword123!', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiProperty({ enum: AdminRole, required: false })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}
