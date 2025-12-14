import { Injectable, BadRequestException, NotFoundException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BookingInvoiceService } from './booking-invoice.service';
import { CreateBookingRequestDto } from '../dtos/booking.dto';
import { Booking, BookingStatus, Customer, Driver, Invoice } from '@prisma/client';
import { FirebaseService } from 'src/firebase/firebase.service';
import { UploadUrlResponseDto, uploadUrlDto } from 'src/common/dtos/upload-url.dto';
import { AssignmentService } from '../assignment/assignment.service';
import { REALTIME_BUS, RealtimeBus } from 'src/redis/interfaces/realtime-bus.interface';
import { Response, Request } from 'express';
import { toPackageDetailsDto, toPackageCreateData } from '../utils/package.utils';
import { toAddressCreateData, toBookingAddressDto } from '../utils/address.utils';
import { BookingPaymentService } from './booking-payment.service';
import { BookingNotificationService } from './booking-notification.service';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

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
    @Inject(REALTIME_BUS) private readonly realtimeBus: RealtimeBus,
    private readonly bookingPaymentService: BookingPaymentService,
    private readonly notificationService: BookingNotificationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new booking
   */
  async createBooking(
    userId: string,
    createRequest: CreateBookingRequestDto,
  ): Promise<Booking> {

    // Generate OTPs
    // const isTest = this.configService.get('NODE_ENV') !== 'production';
    const isTest = this.configService.get('NODE_ENV') === 'test';
    const pickupOtp = isTest ? '1234' : randomInt(1000, 9999).toString();
    const dropOtp = isTest ? '1234' : randomInt(1000, 9999).toString();

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
          invoices: true,
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
        invoices: true,
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
        invoices: true,
        assignedDriver: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
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
        invoices: true,
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
    reason: string,
  ): Promise<void> {

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
    
    // If no final invoice exists (PENDING or DRIVER_ASSIGNED booking), just cancel without refund processing
    if (!finalInvoice || !booking.assignedDriver) {
      await this.cancelUnconfirmedBooking(bookingId, userId, reason, booking);
      return;
    }

    await this.cancelConfirmedBooking(
      bookingId,
      userId,
      reason,
      { ...booking, assignedDriver: booking.assignedDriver, customer: booking.customer },
      finalInvoice,
    );
    return;
  }

  /**
   * Cancel an unconfirmed booking (no final invoice)
   * This is for PENDING or DRIVER_ASSIGNED bookings where no payment/invoice has been finalized.
   * Simply cancels the booking and releases the driver if assigned.
   */
  private async cancelUnconfirmedBooking(
    bookingId: string,
    userId: string,
    reason: string,
    booking: Booking,
  ): Promise<void> {
    const logger = new Logger('BookingCustomerService');

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      // If driver was assigned (DRIVER_ASSIGNED state), release them
      if (booking.assignedDriverId) {
        await tx.driver.update({
          where: { id: booking.assignedDriverId },
          data: { driverStatus: 'AVAILABLE' },
        });

        // Also mark assignment as rejected/cancelled so it doesn't linger
        await tx.bookingAssignment.updateMany({
          where: { bookingId, driverId: booking.assignedDriverId, status: 'OFFERED' },
          data: { status: 'AUTO_REJECTED', respondedAt: new Date() }
        });
      }
    });

    // Send notification and cleanup
    this.notificationService.notifyCustomerBookingCancelled(userId);
    if (booking.assignedDriverId) {
      this.notificationService.notifyDriverRideCancelled(booking.assignedDriverId);
    }
    await this.bookingAssignmentService.onBookingCancelled(bookingId);
  }

  /**
   * Cancel a confirmed booking (with final invoice)
   * This involves refund processing, driver compensation, and financial transaction logging.
   */
  private async cancelConfirmedBooking(
    bookingId: string,
    userId: string,
    reason: string,
    booking: Booking & {assignedDriver: Driver, customer: Customer},
    finalInvoice: Invoice,
  ): Promise<void> {
    const logger = new Logger('BookingCustomerService');

    // Process cancellation and refunds in transaction (for bookings with FINAL invoice)
    const { walletRefund, driverCompensation, driverId } = await this.prisma.$transaction(async (tx) => {
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
      const refundAmounts = await this.bookingPaymentService.processRefund(
        userId,
        {
          ...booking,
          assignedDriver: booking.assignedDriver,
          customer: booking.customer!,
        },
        finalInvoice,
        reason,
        tx,
      );

      // Reset driver status if assigned
      if (booking.assignedDriverId) {
        await tx.bookingAssignment.updateMany({
          where: { bookingId, driverId: booking.assignedDriverId},
          data: { status: 'AUTO_REJECTED', respondedAt: new Date() }
        });

        await tx.driver.update({
          where: { id: booking.assignedDriverId },
          data: { driverStatus: 'AVAILABLE' },
        });
      }
      
      return refundAmounts;
    });

    // Send notifications (fire-and-forget, outside transaction)
    this.notificationService.notifyCustomerBookingCancelled(userId);
    
    // Notify about wallet refund or charge
    if (walletRefund > 0) {
      this.notificationService.notifyCustomerWalletCredited(userId, walletRefund);
    } else if (walletRefund < 0) {
      // Wallet was debited for cancellation charge
      this.notificationService.notifyCustomerWalletDebtCleared(userId, walletRefund);
    }

    // Notify driver about cancellation and compensation
    if (driverId) {
      this.notificationService.notifyDriverRideCancelled(driverId);
      
      // Notify driver about compensation if applicable
      if (driverCompensation > 0) {
        this.notificationService.notifyDriverWalletChange(driverId, driverCompensation, false);
      }
    }

    await this.bookingAssignmentService.onBookingCancelled(bookingId);
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

    // Send initial data from cache
    try {
      const cacheKey = `driver_navigation:${driverId}`;
      const cachedData = await this.realtimeBus.get(cacheKey);

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

    await this.realtimeBus.subscribe(sseKey, handler);

    // Handle client disconnect
    request.on('close', async () => {
      clearInterval(heartbeat);
      await this.realtimeBus.unsubscribe(sseKey, handler);
      response.end();
    });
  }
}
