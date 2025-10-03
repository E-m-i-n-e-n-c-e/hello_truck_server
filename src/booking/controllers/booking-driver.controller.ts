import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { User } from 'src/token/decorators/user.decorator';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { BookingAssignmentResponseDto } from '../dtos/booking-assignment.dto';
import { BookingDriverService } from '../services/booking-driver.service';

@Controller('bookings/driver')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('driver')
export class BookingDriverController {
  constructor(private readonly bookingDriverService: BookingDriverService) {}

  @Get('current-assignment')
  @Serialize(BookingAssignmentResponseDto)
  getDriverAssignment(@User('userId') driverId: string) {
    return this.bookingDriverService.getDriverAssignment(driverId);
  }

  @Get('history')
  @Serialize(BookingAssignmentResponseDto)
  getAssignmentHistory(@User('userId') driverId: string) {
    return this.bookingDriverService.getAssignmentHistory(driverId);
  }

  @Post('accept/:assignmentId')
  acceptBooking(@Param('assignmentId') assignmentId: string) {
    return this.bookingDriverService.acceptBooking(assignmentId);
  }

  @Post('reject/:assignmentId')
  rejectBooking(@Param('assignmentId') assignmentId: string) {
    return this.bookingDriverService.rejectBooking(assignmentId);
  }
}


