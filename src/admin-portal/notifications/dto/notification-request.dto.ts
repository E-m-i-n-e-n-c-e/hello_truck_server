import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator';

/**
 * Get Notifications Request DTO (Query params)
 */
export class GetNotificationsRequestDto {
  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @ToBoolean()
  unreadOnly?: boolean = false;
}
