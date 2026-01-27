import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ description: 'Booking ID to attach note to' })
  @IsString()
  bookingId: string;

  @ApiProperty({ description: 'Note content' })
  @IsString()
  @MinLength(1)
  content: string;
}
