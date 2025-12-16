import { Controller, Post, Body, UseGuards, Get, Query, Param, Delete, Put, Res, Req } from '@nestjs/common';
import { User } from 'src/token/decorators/user.decorator';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { BookingCustomerService } from '../services/booking-customer.service';
import { BookingEstimateRequestDto, BookingEstimateResponseDto } from '../dtos/booking-invoice.dto';
import { CreateBookingRequestDto, BookingResponseDto, CancelBookingDto, CancellationConfigResponseDto } from '../dtos/booking.dto';
import { seconds } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { UploadUrlResponseDto, uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import { Response, Request } from 'express';
import { BookingInvoiceService } from '../services/booking-invoice.service';

@Controller('bookings/customer')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('customer')
@Throttle({ default: { ttl: seconds(60), limit: 40 } })
export class BookingCustomerController {
  constructor(
    private readonly bookingInvoiceService: BookingInvoiceService,
    private readonly bookingCustomerService: BookingCustomerService,
  ) {}

  @Post('estimate')
  @Serialize(BookingEstimateResponseDto)
  async getBookingEstimate(
    @User('userId') userId: string,
    @Body() estimateRequest: BookingEstimateRequestDto,
  ): Promise<BookingEstimateResponseDto> {
    return this.bookingInvoiceService.calculateEstimate(estimateRequest);
  }

  @Post()
  @Serialize(BookingResponseDto)
  async createBooking(
    @User('userId') userId: string,
    @Body() createRequest: CreateBookingRequestDto,
  ) {
    return this.bookingCustomerService.createBooking(userId, createRequest);
  }

  @Get('active')
  @Serialize(BookingResponseDto)
  async getActiveBookings(@User('userId') userId: string) {
    return this.bookingCustomerService.getActiveBookings(userId);
  }

  @Get('history')
  @Serialize(BookingResponseDto)
  async getBookingHistory(@User('userId') userId: string) {
    return this.bookingCustomerService.getBookingHistory(userId);
  }

  @Get('upload-url')
  @Serialize(UploadUrlResponseDto)
  async getUploadUrl(
    @User('userId') userId: string,
    @Query() uploadUrlDto: uploadUrlDto,
  ) {
    return this.bookingCustomerService.getUploadUrl(userId, uploadUrlDto);
  }

  @Get('cancellation-config')
  @Serialize(CancellationConfigResponseDto)
  async getCancellationConfig() {
    return this.bookingCustomerService.getCancellationConfig();
  }

  @Post('cancel/:id')
  async cancelBooking(
    @User('userId') userId: string,
    @Param('id') bookingId: string,
    @Body() cancelDto: CancelBookingDto,
  ) {
    await this.bookingCustomerService.cancelBooking(
      userId,
      bookingId,
      cancelDto.reason,
    );
    return { message: 'Booking cancelled successfully' };
  }

  @Get('driver-navigation/:bookingId')
  async getDriverNavigationUpdates(
    @User('userId') userId: string,
    @Param('bookingId') bookingId: string,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.bookingCustomerService.getDriverNavigationUpdates(userId, bookingId, response, request);
  }

  @Get(':id')
  @Serialize(BookingResponseDto)
  async getBooking(
    @User('userId') userId: string,
    @Param('id') bookingId: string,
  ) {
    return this.bookingCustomerService.getBooking(userId, bookingId);
  }
}
