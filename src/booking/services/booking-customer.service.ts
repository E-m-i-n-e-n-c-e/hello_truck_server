import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BookingInvoiceService } from './booking-invoice.service';
import { CreateBookingRequestDto } from '../dtos/booking.dto';
import { Booking, BookingStatus } from '@prisma/client';
import { FirebaseService } from 'src/firebase/firebase.service';
import { UploadUrlResponseDto, uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import { AssignmentService } from '../assignment/assignment.service';
import { RedisService } from 'src/redis/redis.service';
import { Response, Request } from 'express';
import { toPackageDetailsDto, toPackageCreateData } from '../utils/package.utils';
import { toAddressCreateData, toBookingAddressDto } from '../utils/address.utils';
import { BookingPaymentService } from './booking-payment.service';
import { FcmEventType } from 'src/common/types/fcm.types';

@Injectable()
export class BookingCustomerService {
  private readonly STATUS_ORDER: BookingStatus[] = [
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

  private isAtOrAfter(current: BookingStatus, threshold: BookingStatus): boolean {
    return this.STATUS_ORDER.indexOf(current) >= this.STATUS_ORDER.indexOf(threshold);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: BookingInvoiceService,
    private readonly firebaseService: FirebaseService,
    private readonly bookingAssignmentService: AssignmentService,
    private readonly redisService: RedisService,
    private readonly bookingPaymentService: BookingPaymentService,
  ) {}

  /**
   * Create a new booking
   */
  async createBooking(
    userId: string,
    createRequest: CreateBookingRequestDto,
  ): Promise<Booking> {

    // Generate OTPs
    const pickupOtp = '1234'; // TODO: Generate random OTP
    const dropOtp = '1234';

    // Use transaction to ensure atomicity
    const booking = await this.prisma.$transaction(async (tx) => {
      // 1. Create booking
      const createdBooking = await tx.booking.create({
        data: {
          customer: {
            connect: { id: userId },
          },
          package: {
            create: toPackageCreateData(createRequest.package),
          },
          pickupAddress: {
            create: toAddressCreateData(createRequest.pickupAddress),
          },
          dropAddress: {
            create: toAddressCreateData(createRequest.dropAddress),
          },
          status: BookingStatus.PENDING,
          pickupOtp,
          dropOtp,
        },
        include: {
          package: true,
          pickupAddress: true,
          dropAddress: true,
          customer: true,
        },
      });

      // 2. Create ESTIMATE invoice with wallet applied using InvoiceService
      await this.invoiceService.createEstimateInvoice(
        createdBooking.id,
        {
          packageDetails: toPackageDetailsDto(createdBooking.package),
          pickupAddress: toBookingAddressDto(createdBooking.pickupAddress),
          dropAddress: toBookingAddressDto(createdBooking.dropAddress),
        },
        Number(createdBooking.customer?.walletBalance),
        tx,
      );

      return createdBooking;
    });

    await this.bookingAssignmentService.onBookingCreated(booking.id);

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
      take: 20, // Limit to last 20 bookings
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
        assignedDriver: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  /**
   * Cancel a booking with refund processing
   */
  async cancelBooking(
    userId: string, 
    bookingId: string,
    reason?: string,
  ): Promise<void> {
    const logger = new Logger('BookingCustomerService');
    logger.log(`Processing cancellation for booking ${bookingId} by customer ${userId}`);

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        assignedDriver: true,
        invoices: {
          where: { type: 'FINAL' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if(!booking.customer){
      throw new NotFoundException('Customer not found');
    }

    if (booking.customerId !== userId) {
      throw new BadRequestException('You can only cancel your own bookings');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    // Check if cancellable
    if (
      this.isAtOrAfter(booking.status, BookingStatus.PICKUP_VERIFIED)
    ) {
      throw new BadRequestException('Booking cannot be cancelled after pickup verification');
    }

    const finalInvoice = booking.invoices[0];
    if (!finalInvoice) {
      throw new NotFoundException('Final invoice not found');
    }

    // Process cancellation and refunds in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      // Process refunds using payment service utility
      await this.bookingPaymentService.processRefund(
        userId,
        {
          ...booking,
          customer: booking.customer!,
        },
        finalInvoice,
        reason,
        tx,
      );

      // Reset driver status if assigned
      if (booking.assignedDriverId) {
        await tx.driver.update({
          where: { id: booking.assignedDriverId },
          data: { driverStatus: 'AVAILABLE' },
        });
      }
    });

    this.firebaseService.notifyAllSessions(userId, 'customer', {
      notification: {
        title: 'Booking Cancelled',
        body: 'Your booking has been successfully cancelled. Any applicable refund will be processed and credited to your original payment method within 24 hours.',
      },
      data: {
        event: FcmEventType.BookingStatusChange,
      },
    });

    if (booking.assignedDriverId) {
      this.firebaseService.notifyAllSessions(booking.assignedDriverId, 'driver', {
        notification: {
          title: 'Booking Cancelled',
          body: 'Sorry, your ride has been cancelled by the customer. You will receive some compensation for your time.',
        },
        data: {
          event: FcmEventType.RideCancelled,
        },
      });
    }

    await this.bookingAssignmentService.onBookingCancelled(booking.id);
    logger.log(`Cancellation processed for booking ${bookingId}`);
  }

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
