import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@hellotruck.in' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.AGENT })
  @IsEnum(AdminRole)
  role: AdminRole;
}
