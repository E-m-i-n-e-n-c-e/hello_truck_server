import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BookingEstimateService } from './booking-estimate.service';
import { CreateBookingRequestDto, BookingResponseDto } from '../dtos/booking.dto';
import { BookingEstimateRequestDto } from '../dtos/booking-estimate.dto';
import { Booking, BookingStatus } from '@prisma/client';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import { UploadUrlResponseDto, uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import { BookingAssignmentService } from './booking-assignment.service';

@Injectable()
export class BookingCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingEstimateService: BookingEstimateService,
    private readonly firebaseService: FirebaseService,
    private readonly bookingAssignmentService: BookingAssignmentService,
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
          formattedAddress: createRequest.pickupAddress.formattedAddress,
          addressDetails: createRequest.pickupAddress.addressDetails,
          latitude: createRequest.pickupAddress.latitude,
          longitude: createRequest.pickupAddress.longitude,
        },
      });

      const dropAddress = await tx.address.create({
        data: {
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
        },
        include: {
          package: true,
          pickupAddress: true,
          dropAddress: true,
        },
      }); 
      await this.bookingAssignmentService.advance(booking.id, false);

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
    
    await this.bookingAssignmentService.advance(booking.id, false);
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
}
