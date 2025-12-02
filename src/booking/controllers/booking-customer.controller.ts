import { Controller, Post, Body, UseGuards, Get, Query, Param, Delete, Put, Res, Req } from '@nestjs/common';
import { User } from 'src/token/decorators/user.decorator';
import { RolesGuard } from 'src/token/guards/roles.guard';
import { AccessTokenGuard } from 'src/token/guards/access-token.guard';
import { Roles } from 'src/token/decorators/roles.decorator';
import { Serialize } from 'src/common/interceptors/serialize.interceptor';
import { BookingCustomerService } from '../services/booking-customer.service';
import { BookingEstimateRequestDto, BookingEstimateResponseDto } from '../dtos/booking-estimate.dto';
import { CreateBookingRequestDto, BookingResponseDto } from '../dtos/booking.dto';
import { seconds } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { UploadUrlResponseDto, uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import { BookingEstimateService } from '../services/booking-estimate.service';
import { Response, Request } from 'express';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';
import { UpdateBookingAddressDto } from '../dtos/booking-address.dto';
import { UpdatePackageDetailsDto } from '../dtos/package.dto';

@Controller('bookings/customer')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('customer')
@Throttle({ default: { ttl: seconds(60), limit: 40 } })
export class BookingCustomerController {
  constructor(
    private readonly bookingEstimateService: BookingEstimateService,
    private readonly bookingCustomerService: BookingCustomerService,
  ) {}

  @Post('estimate')
  @Serialize(BookingEstimateResponseDto)
  async getBookingEstimate(
    @User('userId') userId: string,
    @Body() estimateRequest: BookingEstimateRequestDto,
  ): Promise<BookingEstimateResponseDto> {
    return this.bookingEstimateService.calculateEstimate(estimateRequest);
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

  @Get(':id')
  @Serialize(BookingResponseDto)
  async getBooking(
    @User('userId') userId: string,
    @Param('id') bookingId: string,
  ) {
    return this.bookingCustomerService.getBooking(userId, bookingId);
  }

  @Delete(':id')
  async cancelBooking(
    @User('userId') userId: string,
    @Param('id') bookingId: string,
  ) {
    return this.bookingCustomerService.cancelBooking(userId, bookingId);
  }

  // Removed generic update endpoint in favor of specific endpoints

  // Update only pickup address
  @Put('pickup/:id')
  @Serialize(SuccessResponseDto)
  async updatePickup(
    @User('userId') userId: string,
    @Param('id') bookingId: string,
    @Body() pickupAddress: UpdateBookingAddressDto,
  ) {
    return this.bookingCustomerService.updatePickup(userId, bookingId, pickupAddress);
  }

  // Update only drop address
  @Put('drop/:id')
  @Serialize(SuccessResponseDto)
  async updateDrop(
    @User('userId') userId: string,
    @Param('id') bookingId: string,
    @Body() dropAddress: UpdateBookingAddressDto,
  ) {
    return this.bookingCustomerService.updateDrop(userId, bookingId, dropAddress);
  }

  // Update only package details
  @Put('package/:id')
  @Serialize(SuccessResponseDto)
  async updatePackage(
    @User('userId') userId: string,
    @Param('id') bookingId: string,
    @Body() packageDetails: UpdatePackageDetailsDto,
  ) {
    return this.bookingCustomerService.updatePackage(userId, bookingId, packageDetails);
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
}
