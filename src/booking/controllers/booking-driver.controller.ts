import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { User } from 'src/token/decorators/user.decorator';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { BookingAssignmentResponseDto } from '../dtos/booking-assignment.dto';
import { BookingDriverService } from '../services/booking-driver.service';
import { RideSummaryDto } from '../dtos/booking.dto';

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

  // Pickup arrived
  @Post('pickup/arrived')
  pickupArrived(@User('userId') driverId: string) {
    return this.bookingDriverService.pickupArrived(driverId);
  }

  //Drop arrived
  @Post('drop/arrived')
  dropArrived(@User('userId') driverId: string) {
    return this.bookingDriverService.dropArrived(driverId);
  }

  // Verify pickup OTP
  @Post('pickup/verify')
  verifyPickup(@User('userId') driverId: string, @Body('otp') otp: string) {
    return this.bookingDriverService.verifyPickup(driverId, otp);
  }

  // Verify drop OTP
  @Post('drop/verify')
  verifyDrop(@User('userId') driverId: string, @Body('otp') otp: string) {
    return this.bookingDriverService.verifyDrop(driverId, otp);
  }

  // Start ride (transition from PICKUP_VERIFIED -> IN_TRANSIT)
  @Post('start')
  startRide(@User('userId') driverId: string) {
    return this.bookingDriverService.startRide(driverId);
  }

  // Finish ride (transition from DROP_VERIFIED -> COMPLETED)
  @Post('finish')
  finishRide(@User('userId') driverId: string) {
    return this.bookingDriverService.finishRide(driverId);
  }

  // Settle with cash (mark payment as received in cash)
  @Post('settle-cash')
  settleWithCash(@User('userId') driverId: string) {
    return this.bookingDriverService.settleWithCash(driverId);
  }

  // Get ride summary (total rides and earnings for a date)
  @Get('ride-summary')
  @Serialize(RideSummaryDto)
  getRideSummary(
    @User('userId') driverId: string,
    @Query('date') date?: string, // Optional: YYYY-MM-DD format, defaults to today
  ) {
    return this.bookingDriverService.getRideSummary(driverId, date);
  }
}

