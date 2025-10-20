import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BookingEstimateService } from './booking-estimate.service';
import { CreateBookingRequestDto, BookingResponseDto, UpdateBookingRequestDto } from '../dtos/booking.dto';
import { BookingEstimateRequestDto } from '../dtos/booking-estimate.dto';
import { Address, Booking, BookingStatus, Package, VehicleType, WeightUnit } from '@prisma/client';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import { UploadUrlResponseDto, uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import { AssignmentService } from '../assignment/assignment.service';
import { RedisService } from 'src/redis/redis.service';
import { Response, Request } from 'express';
import * as geolib from 'geolib';
import { SuccessResponseDto } from 'src/common/dtos/success.dto';

@Injectable()
export class BookingCustomerService {
  private readonly locationEditLimitMeters = 1000;
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

    const estimate = this.bookingEstimateService.calculateEstimate(estimateRequest);

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
    updateData: UpdateBookingRequestDto,
  ): Promise<SuccessResponseDto> {
    // Load booking with relations
    const existing = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId: userId },
      include: { pickupAddress: true, dropAddress: true, package: true },
    });

    if (!existing) throw new NotFoundException('Booking not found');

    // Validate update DTO & status & distance restrictions
    this.validateBookingUpdate(existing, updateData);

    // Compute effective values
    const effectivePickup = {
      ...existing.pickupAddress,
      ...updateData.pickupAddress,
      latitude: updateData.pickupAddress?.latitude ?? Number(existing.pickupAddress.latitude),
      longitude: updateData.pickupAddress?.longitude ?? Number(existing.pickupAddress.longitude),
    };

    const effectiveDrop = {
      ...existing.dropAddress,
      ...updateData.dropAddress,
      latitude: updateData.dropAddress?.latitude ?? Number(existing.dropAddress.latitude),
      longitude: updateData.dropAddress?.longitude ?? Number(existing.dropAddress.longitude),
    };

    const effectivePackage = {
      ...existing.package,
      ...updateData.package,
      productName: updateData.package?.agricultural?.productName ?? existing.package.productName,
      approximateWeight: updateData.package?.agricultural?.approximateWeight ?? existing.package.approximateWeight,
      weightUnit: updateData.package?.agricultural?.weightUnit ?? existing.package.weightUnit,
      averageWeight: updateData.package?.nonAgricultural?.averageWeight ?? existing.package.averageWeight,
      bundleWeight: updateData.package?.nonAgricultural?.bundleWeight ?? existing.package.bundleWeight,
      numberOfProducts: updateData.package?.nonAgricultural?.numberOfProducts ?? existing.package.numberOfProducts,
      length: updateData.package?.nonAgricultural?.packageDimensions?.length ?? existing.package.length,
      width: updateData.package?.nonAgricultural?.packageDimensions?.width ?? existing.package.width,
      height: updateData.package?.nonAgricultural?.packageDimensions?.height ?? existing.package.height,
      dimensionUnit: updateData.package?.nonAgricultural?.packageDimensions?.unit ?? existing.package.dimensionUnit,
      description: updateData.package?.nonAgricultural?.packageDescription ?? existing.package.description,
      packageImageUrl: updateData.package?.nonAgricultural?.packageImageUrl ?? existing.package.packageImageUrl,
      gstBillUrl: updateData.package?.gstBillUrl ?? existing.package.gstBillUrl,
      transportDocUrls: updateData.package?.transportDocUrls ?? existing.package.transportDocUrls,
    };

    // Recalculate estimate
    const estimateRequest: BookingEstimateRequestDto = {
      pickupAddress: {
        latitude: effectivePickup.latitude,
        longitude: effectivePickup.longitude,
        formattedAddress: effectivePickup.formattedAddress,
        addressDetails: effectivePickup.addressDetails ?? undefined,
      },
      dropAddress: {
        latitude: effectiveDrop.latitude,
        longitude: effectiveDrop.longitude,
        formattedAddress: effectiveDrop.formattedAddress,
        addressDetails: effectiveDrop.addressDetails ?? undefined,
      },
      packageDetails: {
        packageType: effectivePackage.packageType,
        productType: effectivePackage.productType,
        agricultural: effectivePackage.agricultural,
        nonAgricultural: effectivePackage.nonAgricultural,
        gstBillUrl: effectivePackage.gstBillUrl ?? undefined,
        transportDocUrls: effectivePackage.transportDocUrls,
      },
    };
    const estimate = this.bookingEstimateService.calculateEstimate(estimateRequest);
    const bookingUpdateData: any = { distanceKm: estimate.distanceKm };

    if (!!updateData.pickupAddress) bookingUpdateData.pickupAddress = { update: effectivePickup };
    if (!!updateData.dropAddress) bookingUpdateData.dropAddress = { update: effectiveDrop };
    if (!!updateData.package) bookingUpdateData.package = { update: effectivePackage };

    // Update booking with nested relations
    await this.prisma.booking.update({
      where: { id: existing.id },
      data: bookingUpdateData,
    });

    return { success: true, message: 'Booking updated successfully' };
  }

  /**
   * Validates the update data for a booking, handling all status, restriction, and distance checks.
   */
  private validateBookingUpdate(existing: Booking & { pickupAddress: Address; dropAddress: Address; package: Package }, updateData: UpdateBookingRequestDto): void {
    const statusOrder = [
      BookingStatus.PENDING,
      BookingStatus.DRIVER_ASSIGNED,
      BookingStatus.CONFIRMED,
      BookingStatus.PICKUP_ARRIVED,
      BookingStatus.PICKUP_VERIFIED,
      BookingStatus.IN_TRANSIT,
      BookingStatus.DROP_ARRIVED,
      BookingStatus.DROP_VERIFIED,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.EXPIRED,
    ];

    const currentIndex = statusOrder.indexOf(existing.status);

    const pickupChangeRequested = !!updateData.pickupAddress;
    const dropChangeRequested = !!updateData.dropAddress;
    const packageChangeRequested = !!updateData.package;

    // Status restrictions
    if (pickupChangeRequested && currentIndex >= statusOrder.indexOf(BookingStatus.PICKUP_ARRIVED))
      throw new ForbiddenException('Pickup location cannot be changed after driver has arrived at pickup');

    if (packageChangeRequested && currentIndex >= statusOrder.indexOf(BookingStatus.PICKUP_VERIFIED))
      throw new ForbiddenException('Package details cannot be changed after pickup verification');

    if (dropChangeRequested && currentIndex >= statusOrder.indexOf(BookingStatus.DROP_ARRIVED))
      throw new ForbiddenException('Drop location cannot be changed after driver has arrived at drop');

    // 1000 meters limit for pickup edits (only when coordinates change)
    if (
      pickupChangeRequested &&
      updateData.pickupAddress?.latitude !== undefined &&
      updateData.pickupAddress?.longitude !== undefined
    ) {
      const distance = geolib.getDistance(
        {
          latitude: Number(existing.pickupAddress.latitude),
          longitude: Number(existing.pickupAddress.longitude),
        },
        {
          latitude: Number(updateData.pickupAddress.latitude),
          longitude: Number(updateData.pickupAddress.longitude),
        },
      );
      if (distance > this.locationEditLimitMeters)
        throw new BadRequestException(`Pickup location change exceeds ${this.locationEditLimitMeters} meters limit`);
    }

    // 1000 meters limit for drop edits (only when coordinates change)
    if (
      dropChangeRequested &&
      updateData.dropAddress?.latitude !== undefined &&
      updateData.dropAddress?.longitude !== undefined
    ) {
      const distance = geolib.getDistance(
        {
          latitude: Number(existing.dropAddress.latitude),
          longitude: Number(existing.dropAddress.longitude),
        },
        {
          latitude: Number(updateData.dropAddress.latitude),
          longitude: Number(updateData.dropAddress.longitude),
        },
      );
      if (distance > this.locationEditLimitMeters)
        throw new BadRequestException(`Drop location change exceeds ${this.locationEditLimitMeters} meters limit`);
    }
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
