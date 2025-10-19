import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BookingEstimateService } from './booking-estimate.service';
import { CreateBookingRequestDto, BookingResponseDto } from '../dtos/booking.dto';
import { BookingEstimateRequestDto } from '../dtos/booking-estimate.dto';
import { Booking, BookingStatus } from '@prisma/client';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import { UploadUrlResponseDto, uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import { AssignmentService } from '../assignment/assignment.service';
import { RedisService } from 'src/redis/redis.service';
import { Response, Request } from 'express';

@Injectable()
export class BookingCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingEstimateService: BookingEstimateService,
    private readonly firebaseService: FirebaseService,
    private readonly bookingAssignmentService: AssignmentService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Create a new booking
   */
  async createBooking(
    userId: string,
    createRequest: CreateBookingRequestDto,
  ): Promise<Booking> {
    // First get estimate to validate and get pricing details
    const estimateRequest: BookingEstimateRequestDto = {
      pickupAddress: createRequest.pickupAddress,
      dropAddress: createRequest.dropAddress,
      packageDetails: createRequest.package,
    };

    const estimate = await this.bookingEstimateService.calculateEstimate(userId, estimateRequest);

    // Find the selected vehicle option
    const selectedVehicleOption = estimate.vehicleOptions.find(
      option => option.vehicleType === createRequest.selectedVehicleType
    );

    if (!selectedVehicleOption || !selectedVehicleOption.isAvailable) {
      throw new BadRequestException('Selected vehicle type is not available for this booking');
    }

    // Use transaction for address, package, and booking creation
    const booking = await this.prisma.$transaction(async (tx) => {
      // Create addresses first
      const pickupAddress = await tx.address.create({
        data: {
          addressName: createRequest.pickupAddress.addressName,
          contactName: createRequest.pickupAddress.contactName,
          contactPhone: createRequest.pickupAddress.contactPhone,
          noteToDriver: createRequest.pickupAddress.noteToDriver,
          formattedAddress: createRequest.pickupAddress.formattedAddress,
          addressDetails: createRequest.pickupAddress.addressDetails,
          latitude: createRequest.pickupAddress.latitude,
          longitude: createRequest.pickupAddress.longitude,
        },
      });

      const dropAddress = await tx.address.create({
        data: {
          addressName: createRequest.dropAddress.addressName,
          contactName: createRequest.dropAddress.contactName,
          contactPhone: createRequest.dropAddress.contactPhone,
          noteToDriver: createRequest.dropAddress.noteToDriver,
          formattedAddress: createRequest.dropAddress.formattedAddress,
          addressDetails: createRequest.dropAddress.addressDetails,
          latitude: createRequest.dropAddress.latitude,
          longitude: createRequest.dropAddress.longitude,
        },
      });

      // Create package
      const packageData = await tx.package.create({
        data: {
          packageType: createRequest.package.packageType,
          productType: createRequest.package.productType,
          productName: createRequest.package.agricultural?.productName,
          approximateWeight: createRequest.package.agricultural?.approximateWeight,
          weightUnit: createRequest.package.agricultural?.weightUnit,
          averageWeight: createRequest.package.nonAgricultural?.averageWeight,
          bundleWeight: createRequest.package.nonAgricultural?.bundleWeight,
          numberOfProducts: createRequest.package.nonAgricultural?.numberOfProducts,
          length: createRequest.package.nonAgricultural?.packageDimensions?.length,
          width: createRequest.package.nonAgricultural?.packageDimensions?.width,
          height: createRequest.package.nonAgricultural?.packageDimensions?.height,
          dimensionUnit: createRequest.package.nonAgricultural?.packageDimensions?.unit,
          description: createRequest.package.nonAgricultural?.packageDescription,
          packageImageUrl: createRequest.package.nonAgricultural?.packageImageUrl,
          gstBillUrl: createRequest.package.gstBillUrl,
          transportDocUrls: createRequest.package.transportDocUrls,
        },
      });
      // const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit OTP
      // const dropOtp = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit OTP
      const pickupOtp = '1234';
      const dropOtp = '1234';
      console.log("Otp generated", pickupOtp, dropOtp);

      // Create booking
      const booking = await tx.booking.create({
        data: {
          customerId: userId,
          packageId: packageData.id,
          pickupAddressId: pickupAddress.id,
          dropAddressId: dropAddress.id,
          estimatedCost: selectedVehicleOption.estimatedCost,
          distanceKm: estimate.distanceKm,
          baseFare: selectedVehicleOption.breakdown.baseFare,
          distanceCharge: selectedVehicleOption.breakdown.distanceCharge,
          weightMultiplier: selectedVehicleOption.breakdown.weightMultiplier,
          vehicleMultiplier: selectedVehicleOption.breakdown.vehicleMultiplier,
          suggestedVehicleType: createRequest.selectedVehicleType,
          status: BookingStatus.PENDING,
          pickupOtp: pickupOtp,
          dropOtp: dropOtp,
        },
        include: {
          package: true,
          pickupAddress: true,
          dropAddress: true,
        },
      });
      await this.bookingAssignmentService.onBookingCreated(booking.id);

      return booking;
    });

    return booking;
  }

  /**
   * Get active bookings for customer
   */
  async getActiveBookings(userId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId: userId,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.DRIVER_ASSIGNED,
            BookingStatus.CONFIRMED,
            BookingStatus.PICKUP_ARRIVED,
            BookingStatus.PICKUP_VERIFIED,
            BookingStatus.IN_TRANSIT,
            BookingStatus.DROP_ARRIVED,
            BookingStatus.DROP_VERIFIED,
          ],
        },
      },
      include: {
        package: true,
        pickupAddress: true,
        dropAddress: true,
        assignedDriver: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return bookings;
  }

  /**
   * Get booking history for customer
   */
  async getBookingHistory(userId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId: userId,
        status: {
          in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.EXPIRED],
        },
      },
      include: {
        package: true,
        pickupAddress: true,
        dropAddress: true,
        assignedDriver: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Limit to last 10 bookings
    });

    return bookings;
  }

  /**
   * Get specific booking by ID
   */
  async getBooking(userId: string, bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        customerId: userId,
      },
      include: {
        package: true,
        pickupAddress: true,
        dropAddress: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(userId: string, bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        customerId: userId,
        status: BookingStatus.PENDING,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found or cannot be cancelled');
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });

    await this.bookingAssignmentService.onBookingCancelled(booking.id);
  }

  /**
   * Update a booking
   */
  async updateBooking(
    userId: string,
    bookingId: string,
    updateData: Partial<CreateBookingRequestDto>,
  ) : Promise<Booking> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        customerId: userId,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.DRIVER_ASSIGNED],
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found or cannot be updated');
    }

    // Update logic here - for now just return the existing booking
    // This would need more complex logic to handle address and package updates
    return this.getBooking(userId, bookingId);
  }

  /**
   * Map booking from Prisma to response DTO
   */

  async getUploadUrl(userId: string, uploadUrlDto: uploadUrlDto): Promise<UploadUrlResponseDto> {
    const uploadUrl = await this.firebaseService.generateSignedUploadUrl(
      uploadUrlDto.filePath,
      uploadUrlDto.type
    );
    return uploadUrl;
  }

  /**
   * Get driver navigation updates via SSE
   */
  async getDriverNavigationUpdates(
    userId: string,
    bookingId: string,
    response: Response,
    request: Request,
  ): Promise<void> {
    // Verify the booking belongs to the user and has an assigned driver
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        customerId: userId,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.assignedDriverId) {
      throw new BadRequestException('No driver assigned to this booking');
    }

    const driverId = booking.assignedDriverId;

    // Set SSE headers (hardened)
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    if (typeof (response as any).flushHeaders === 'function') {
      (response as any).flushHeaders();
    }

    // Suggest client retry interval
    response.write('retry: 10000\n\n');

    // Send initial data from Redis
    try {
      const redisKey = `driver_navigation:${driverId}`;
      const cachedData = await this.redisService.get(redisKey);

      if (cachedData) {
        const navigationData = JSON.parse(cachedData);
        response.write(`data: ${JSON.stringify(navigationData)}\n\n`);
      }
    } catch (error) {
      console.error('Error reading cached navigation data:', error);
    }

    // Set up Redis subscription for real-time updates (booking-scoped) using shared subscriber
    const sseKey = `driver_navigation_updates:${driverId}`;

    // Heartbeat to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      try { response.write(`: ping\n\n`); } catch (_) {}
    }, 25000); // 25 seconds

    const handler = (message: string) => {
      try {
        const navigationData = JSON.parse(message);
        response.write(`data: ${JSON.stringify(navigationData)}\n\n`);
      } catch (error) {
        // Fallback to raw
        response.write(`data: ${message}\n\n`);
      }
    };

    await this.redisService.subscribeChannel(sseKey, handler);

    // Handle client disconnect
    request.on('close', async () => {
      clearInterval(heartbeat);
      await this.redisService.unsubscribeChannel(sseKey, handler);
      response.end();
    });
  }
}
