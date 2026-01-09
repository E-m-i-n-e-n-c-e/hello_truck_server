import { Expose, Type } from 'class-transformer';
import { DriverBookingResponseDto } from './booking.dto';
import { AssignmentStatus } from '@prisma/client';

export class BookingAssignmentResponseDto  {
  @Expose()
  id: string;

  @Expose()
  driverId: string;

  @Expose()
  bookingId: string;

  @Expose()
  status: AssignmentStatus;

  @Expose()
  commissionRate: Number | null;

  @Expose()
  offeredAt: Date;

  @Expose()
  respondedAt: Date | null;

  @Expose()
  @Type(() => DriverBookingResponseDto)
  booking: DriverBookingResponseDto;
}
