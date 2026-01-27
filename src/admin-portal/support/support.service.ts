/**
 * Support Service
 *
 * Handles:
 * - Booking search by phone number or booking ID
 * - Customer/Driver metadata lookup
 * - Live driver location fetch
 * - Support notes CRUD
 * - Refund history for bookings
 *
 * Note: View actions are NOT logged per design requirements.
 * Only mutation actions (creating notes, fetching live location) are logged.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AdminRole, Prisma } from '@prisma/client';
import { AuditLogService, AuditActionTypes, AuditModules } from '../audit-log/audit-log.service';
import { SearchBookingDto } from './dto/search-booking.dto';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Search bookings with filters
   * Note: Search/view does not require logging
   */
  async searchBookings(filters: SearchBookingDto) {
    const { phoneNumber, bookingId, bookingNumber, status, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: Prisma.BookingWhereInput = {};

    // Search by phone number (customer)
    if (phoneNumber) {
      where.customer = { phoneNumber: { contains: phoneNumber } };
    }

    // Exact match for booking ID (UUID)
    if (bookingId) {
      where.id = bookingId;
    }

    // Exact match for booking number (auto-incremented BigInt)
    if (bookingNumber) {
      where.bookingNumber = BigInt(bookingNumber);
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              phoneNumber: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          assignedDriver: {
            select: {
              id: true,
              phoneNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get complete booking details
   * Note: View does not require logging
   */
  async getBookingDetails(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        assignedDriver: true,
        package: true,
        pickupAddress: true,
        dropAddress: true,
        statusLogs: {
          orderBy: { statusChangedAt: 'asc' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Get RefundIntent if exists
    const refundIntent = await this.prisma.refundIntent.findUnique({
      where: { bookingId },
    });

    // Get admin refund requests for this booking
    const adminRefunds = await this.prisma.adminRefundRequest.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });

    // Get support notes
    const notes = await this.prisma.supportNote.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      booking,
      refundHistory: {
        automatic: refundIntent,
        manual: adminRefunds,
      },
      notes,
    };
  }

  /**
   * Get customer details by ID or phone
   * Note: View does not require logging
   */
  async getCustomerDetails(identifier: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { id: identifier },
          { phoneNumber: identifier },
        ],
      },
      include: {
        walletLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  /**
   * Get driver details by ID or phone
   * Note: View does not require logging
   */
  async getDriverDetails(identifier: string) {
    const driver = await this.prisma.driver.findFirst({
      where: {
        OR: [
          { id: identifier },
          { phoneNumber: identifier },
        ],
      },
      include: {
        documents: true,
        walletLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  /**
   * Fetch live driver location
   * Note: This IS logged because fetching location is sensitive
   */
  async getDriverLocation(driverId: string, userId: string, userRole: AdminRole) {
    // Get location from Redis (current location cache)
    const locationKey = `driver:location:${driverId}`;
    const location = await this.redis.get(locationKey);

    if (!location) {
      throw new NotFoundException('Driver location not available');
    }

    const parsedLocation = JSON.parse(location);

    // Log the location fetch (important for audit - this is sensitive)
    await this.auditLog.log({
      userId,
      role: userRole,
      actionType: AuditActionTypes.DRIVER_LOCATION_FETCHED,
      module: AuditModules.SUPPORT,
      description: `Fetched live location for driver: ${driverId}`,
      entityId: driverId,
      entityType: 'Driver',
    });

    return {
      driverId,
      latitude: parsedLocation.lat,
      longitude: parsedLocation.lng,
      lastUpdated: parsedLocation.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Create support note for a booking
   * Note: This IS logged because it's a mutation
   */
  async createNote(dto: CreateNoteDto, userId: string, userRole: AdminRole, userName: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const note = await this.prisma.supportNote.create({
      data: {
        bookingId: dto.bookingId,
        agentId: userId,
        agentName: userName,
        note: dto.content,
      },
    });

    // Log the action
    await this.auditLog.log({
      userId,
      role: userRole,
      actionType: AuditActionTypes.SUPPORT_NOTE_ADDED,
      module: AuditModules.SUPPORT,
      description: `Added support note to booking ${dto.bookingId}`,
      entityId: dto.bookingId,
      entityType: 'Booking',
    });

    return note;
  }

  /**
   * Get notes for a booking
   * Note: View does not require logging
   */
  async getNotes(bookingId: string) {
    return this.prisma.supportNote.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
