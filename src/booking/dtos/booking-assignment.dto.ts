import { Expose, Type } from 'class-transformer';
import { BookingResponseDto } from './booking.dto';
import { AssignmentStatus, BookingAssignment } from '@prisma/client';

export class BookingAssignmentResponseDto implements BookingAssignment {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  bookingId: string;

  @Expose()
  status: AssignmentStatus;

  @Expose()
  offeredAt: Date;

  @Expose()
  respondedAt: Date | null;

  @Expose()
  @Type(() => BookingResponseDto)
  booking: BookingResponseDto;
}
