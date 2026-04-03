import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdminRefundStatus, AdminRole, Prisma, BookingStatus, DriverStatus, AssignmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AdminNotificationsService } from '../../notifications/admin-notifications.service';
import { AdminNotificationEvent, AdminFcmTopic } from '../../types/admin-notification.types';
import { AUDIT_METADATA_KEY } from '../../audit-log/decorators/audit-log.decorator';
import {
  CreateSupportNoteRequestDto,
  CreateSupportRefundRequestDto,
  ListSupportRefundsRequestDto,
  SearchBookingsRequestDto,
} from '../dto/support-request.dto';
import { SupportQueueService } from './support-queue.service';
import { ACTIVE_REFUND_REQUEST_STATUSES } from '../utils/support.constants';
import { RazorpayService } from '../../razorpay/razorpay.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationsService: AdminNotificationsService,
    private readonly supportQueue: SupportQueueService,
  ) {}

  async searchBookings(filters: SearchBookingsRequestDto) {
    const {
      phoneNumber,
      bookingId,
      bookingNumber,
      status,
      latestRefundStatus,
      hasActiveRefundRequest,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const offset = (page - 1) * limit;
    const conditions: Prisma.Sql[] = [];

    if (phoneNumber) {
      const phonePattern = `%${phoneNumber}%`;
      conditions.push(Prisma.sql`(
        c."phoneNumber" LIKE ${phonePattern} OR
        d."phoneNumber" LIKE ${phonePattern}
      )`);
    }

    if (bookingId) {
      conditions.push(Prisma.sql`b.id = ${bookingId}`);
    }

    if (bookingNumber) {
      const bookingPattern = `${bookingNumber}%`;
      conditions.push(Prisma.sql`b."bookingNumber"::text LIKE ${bookingPattern}`);
    }

    if (status) {
      conditions.push(Prisma.sql`b.status = ${status}::"BookingStatus"`);
    }

    if (latestRefundStatus) {
      conditions.push(Prisma.sql`
        (
          SELECT arr.status
          FROM "AdminRefundRequest" arr
          WHERE arr."bookingId" = b.id
          ORDER BY arr."createdAt" DESC
          LIMIT 1
        ) = ${latestRefundStatus}::"AdminRefundStatus"
      `);
    }

    if (hasActiveRefundRequest !== undefined) {
      if (hasActiveRefundRequest) {
        conditions.push(Prisma.sql`
          EXISTS (
            SELECT 1 FROM "AdminRefundRequest" arr
            WHERE arr."bookingId" = b.id
            AND arr.status = ANY(${ACTIVE_REFUND_REQUEST_STATUSES}::"AdminRefundStatus"[])
          )
        `);
      } else {
        conditions.push(Prisma.sql`
          NOT EXISTS (
            SELECT 1 FROM "AdminRefundRequest" arr
            WHERE arr."bookingId" = b.id
            AND arr.status = ANY(${ACTIVE_REFUND_REQUEST_STATUSES}::"AdminRefundStatus"[])
          )
        `);
      }
    }

    if (startDate) {
      conditions.push(Prisma.sql`b."createdAt" >= ${new Date(startDate)}`);
    }

    if (endDate) {
      conditions.push(Prisma.sql`b."createdAt" <= ${new Date(endDate)}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    const bookingRows = await this.prisma.$queryRaw<Array<{ id: string; total_count: bigint }>>(Prisma.sql`
      WITH booking_data AS (
        SELECT
          b.id,
          COUNT(*) OVER() AS total_count
        FROM "Booking" b
        LEFT JOIN "Customer" c ON c.id = b."customerId"
        LEFT JOIN "Driver" d ON d.id = b."assignedDriverId"
        ${whereClause}
        ORDER BY COALESCE(
          (
            SELECT arr."createdAt"
            FROM "AdminRefundRequest" arr
            WHERE arr."bookingId" = b.id
            ORDER BY arr."createdAt" DESC
            LIMIT 1
          ),
          b."updatedAt",
          b."createdAt"
        ) DESC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT * FROM booking_data
    `);

    const total = bookingRows.length > 0 ? Number(bookingRows[0].total_count) : 0;
    const bookingIds = bookingRows.map((row) => row.id);

    if (bookingIds.length === 0) {
      return {
        bookings: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      include: {
        customer: true,
        assignedDriver: true,
        adminRefundRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: this.refundInclude(),
        },
      },
    });

    const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
    const sortedBookings = bookingIds
      .map((id) => bookingMap.get(id))
      .filter((booking): booking is NonNullable<typeof booking> => !!booking);

    return {
      bookings: sortedBookings.map((booking) => ({
        ...booking,
        latestRefundRequest: booking.adminRefundRequests[0]
          ? this.decorateRefund(booking.adminRefundRequests[0])
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBookingDetails(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        assignedDriver: true,
        package: true,
        pickupAddress: true,
        dropAddress: true,
        invoices: true,
        statusLogs: {
          orderBy: { statusChangedAt: 'asc' },
        },
        refundIntents: {
          orderBy: { createdAt: 'desc' },
        },
        adminRefundRequests: {
          include: this.refundInclude('minimal'),
          orderBy: { createdAt: 'desc' },
        },
        supportNotes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const decoratedRefunds = booking.adminRefundRequests.map((refund) => 
      this.decorateRefund({ 
        ...refund, 
        booking,
        customer: booking.customer,
        driver: booking.assignedDriver,
      })
    );

    return {
      booking,
      refundHistory: {
        intents: booking.refundIntents,
        manual: decoratedRefunds,
        latestRequest: decoratedRefunds[0] || null,
      },
      notes: booking.supportNotes,
    };
  }

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

  async getBookingTracking(bookingId: string, userId: string, userRole: AdminRole) {
    // First, get the booking to find the assigned driver
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        assignedDriverId: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.assignedDriverId) {
      throw new NotFoundException('No driver assigned to this booking');
    }

    const driverId = booking.assignedDriverId;
    const navigationKey = `driver_navigation:${driverId}`;
    const navigation = await this.redis.get(navigationKey);

    const parsedNavigation = navigation ? JSON.parse(navigation) : null;
    const bookingIdMatches = parsedNavigation?.bookingId === bookingId;

    // Use navigation data if booking ID matches, otherwise fallback to geoset
    if (navigation && bookingIdMatches) {
      this.logger.log(`Booking ${bookingId} tracking: active navigation found`);

      return {
        driverId,
        bookingId: parsedNavigation.bookingId,
        latitude: parsedNavigation.location?.latitude ?? null,
        longitude: parsedNavigation.location?.longitude ?? null,
        timeToPickup: parsedNavigation.timeToPickup ?? null,
        timeToDrop: parsedNavigation.timeToDrop ?? null,
        distanceToPickup: parsedNavigation.distanceToPickup ?? null,
        distanceToDrop: parsedNavigation.distanceToDrop ?? null,
        initialDistanceToPickup: parsedNavigation.initialDistanceToPickup ?? null,
        kmTravelled: parsedNavigation.kmTravelled ?? null,
        routePolyline: parsedNavigation.routePolyline ?? null,
        lastUpdated: parsedNavigation.sentAt,
      };
    }

    // Fallback to geoset
    this.logger.log(
      navigation
        ? `Booking ${bookingId} tracking: driver on different booking (${parsedNavigation.bookingId}), using fallback`
        : `Booking ${bookingId} tracking: no navigation data, using fallback`
    );

    const geoPos = await this.redis.geopos('active_drivers', driverId);
    const pos = geoPos?.[0];

    if (!pos || pos[0] === null || pos[1] === null) {
      throw new NotFoundException('Driver location not available');
    }

    // Redis geopos returns [longitude, latitude]
    const longitude = parseFloat(pos[0] as string);
    const latitude = parseFloat(pos[1] as string);

    return {
      driverId,
      bookingId: null,
      latitude,
      longitude,
      timeToPickup: null,
      timeToDrop: null,
      distanceToPickup: null,
      distanceToDrop: null,
      initialDistanceToPickup: null,
      kmTravelled: null,
      routePolyline: null,
      lastUpdated: null,
      isStale: true,
    };
  }

  async createNote(
    dto: CreateSupportNoteRequestDto,
    userId: string,
    userName: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const noteCountBefore = await this.prisma.supportNote.count({
      where: { bookingId: dto.bookingId },
    });

    const note = await this.prisma.supportNote.create({
      data: {
        bookingId: dto.bookingId,
        agentId: userId,
        agentName: userName,
        note: dto.content,
      },
    });

    return {
      ...note,
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot: {
          bookingId: dto.bookingId,
          noteCount: noteCountBefore,
        },
        afterSnapshot: {
          bookingId: dto.bookingId,
          noteCount: noteCountBefore + 1,
          noteId: note.id,
          agentName: userName,
          note: note.note,
        },
        entityId: dto.bookingId,
      },
    };
  }

  async getNotes(bookingId: string) {
    return this.prisma.supportNote.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRequests(
    filters: ListSupportRefundsRequestDto,
    userId?: string,
    userRole?: AdminRole,
  ) {
    const {
      status,
      bookingStatus,
      hasActiveRequest,
      bookingId,
      customerId,
      driverId,
      createdById,
      bookingNumber,
      phoneNumber,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.AdminRefundRequestWhereInput = {};

    // Role-based filtering: CUSTOMER_SUPPORT only sees their own refunds
    if (userRole === AdminRole.CUSTOMER_SUPPORT && userId) {
      where.createdById = userId;
    }

    if (status) where.status = status;
    if (bookingId) where.bookingId = bookingId;
    if (customerId) where.customerId = customerId;
    if (driverId) where.driverId = driverId;
    if (createdById) where.createdById = createdById;

    if (bookingStatus) {
      where.booking = {
        ...where.booking as Prisma.BookingWhereInput,
        status: bookingStatus,
      };
    }

    if (hasActiveRequest !== undefined) {
      const activeStatuses = ACTIVE_REFUND_REQUEST_STATUSES;
      where.booking = {
        ...where.booking as Prisma.BookingWhereInput,
        adminRefundRequests: hasActiveRequest
          ? { some: { status: { in: activeStatuses } } }
          : { none: { status: { in: activeStatuses } } },
      };
    }

    const bookingIdsByNumber = new Set<string>();

    if (bookingNumber) {
      const patterns = [`${bookingNumber}%`];

      const matches = await this.prisma.$queryRaw<Array<{ id: string; pattern: string }>>(
        Prisma.sql`
          SELECT b.id, p.pattern
          FROM "Booking" b, unnest(${patterns}) AS p(pattern)
          WHERE b."bookingNumber"::text LIKE p.pattern
        `
      );

      for (const m of matches) {
        if (m.pattern === `${bookingNumber}%`) bookingIdsByNumber.add(m.id);
      }
    }

    if (bookingNumber) {
      where.bookingId = { in: [...bookingIdsByNumber] };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (phoneNumber) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { phoneNumber: { contains: phoneNumber } },
            { customer: { phoneNumber: { contains: phoneNumber } } },
            { driver: { phoneNumber: { contains: phoneNumber } } },
          ],
        },
      ];
    }

    const [refunds, total] = await Promise.all([
      this.prisma.adminRefundRequest.findMany({
        where,
        include: this.refundInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminRefundRequest.count({ where }),
    ]);

    return {
      refunds: refunds.map((refund) => this.decorateRefund(refund)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRefundById(id: string, userId?: string, userRole?: AdminRole) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id },
      include: this.refundInclude(),
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }

    return this.decorateRefund(refund);
  }

  async createRefund(
    dto: CreateSupportRefundRequestDto,
    createdById: string,
    _creatorRole: AdminRole,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        customer: true,
        assignedDriver: true,
        invoices: {
          where: { type: 'FINAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.customerId || !booking.customer) {
      throw new BadRequestException('Booking has no customer');
    }
    if (dto.customerId && dto.customerId !== booking.customerId) {
      throw new BadRequestException('Customer ID does not match booking');
    }

    const invoice = booking.invoices[0];
    if (!invoice) {
      throw new BadRequestException('Booking has no final invoice');
    }
    if (!invoice.isPaid) {
      throw new BadRequestException('Cannot create refund request for unpaid invoice');
    }

    const totalPaid = Number(invoice.walletApplied) + Number(invoice.finalAmount);
    if (dto.amount > totalPaid) {
      throw new BadRequestException(`Refund amount cannot exceed total paid (Rs.${totalPaid})`);
    }
    if ((dto.cancellationCharge ?? 0) > totalPaid) {
      throw new BadRequestException('Cancellation charge cannot exceed total paid');
    }

    // Check for existing completed refunds (both manual and automatic create RefundIntent)
    // Also check for active manual refund requests (PENDING/APPROVED/REVERT_REQUESTED)
    const bookingWithRefunds = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        adminRefundRequests: {
          where: {
            status: {
              in: ACTIVE_REFUND_REQUEST_STATUSES, // PENDING, APPROVED, REVERT_REQUESTED, REVERTED
            },
          },
          select: { id: true, status: true },
          take: 1,
        },
        refundIntents: {
          where: { status: 'COMPLETED' },
          select: { id: true, isApproved: true },
          take: 1,
        },
      },
    });

    const activeManualRefund = bookingWithRefunds?.adminRefundRequests[0];
    const completedRefund = bookingWithRefunds?.refundIntents[0];

    if (activeManualRefund) {
      throw new BadRequestException('An active manual refund request already exists for this booking');
    }

    if (completedRefund) {
      throw new BadRequestException(`A refund has already been completed for this booking.`);
    }

    const createdRefund = await this.prisma.adminRefundRequest.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId,
        driverId: booking.assignedDriverId,
        amount: dto.amount,
        cancellationCharge: dto.cancellationCharge ?? 0,
        reason: dto.reason,
        phoneNumber: booking.customer.phoneNumber,
        notes: dto.notes,
        evidenceUrls: dto.evidenceUrls ?? [],
        status: AdminRefundStatus.PENDING,
        createdById,
      },
      include: this.refundInclude(),
    });

    this.notificationsService
      .sendNotification(
        {
          title: 'New refund request',
          message: `Refund request created for Booking #${booking.bookingNumber.toString()}`,
          entityId: createdRefund.id,
          entityType: 'REFUND',
          actionUrl: `/support/refunds/${createdRefund.id}`,
        },
        {
          roles: [AdminRole.ADMIN, AdminRole.SUPER_ADMIN],
          useTopic: true,
          topic: AdminFcmTopic.REFUND_REQUESTS,
          event: AdminNotificationEvent.NEW_REFUND_REQUEST,
        },
      )
      .catch((error) => {
        this.logger.error(`Failed to broadcast refund request notification for ${createdRefund.id}`, error);
      });

    return {
      ...this.decorateRefund(createdRefund),
      [AUDIT_METADATA_KEY]: {
        afterSnapshot: {
          refundId: createdRefund.id,
          bookingId: createdRefund.bookingId,
          status: createdRefund.status,
          amount: createdRefund.amount,
        },
        entityId: createdRefund.id,
      },
    };
  }

  async requestRevert(refundId: string, reason: string, requesterId: string, requesterRole: AdminRole) {
    const refund = await this.prisma.adminRefundRequest.findUnique({
      where: { id: refundId },
      include: {
        booking: {
          select: { bookingNumber: true },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException('Refund request not found');
    }
    if (refund.status !== AdminRefundStatus.APPROVED) {
      throw new BadRequestException('Can only request revert for approved refunds');
    }
    if (!refund.bufferExpiresAt || refund.bufferExpiresAt <= new Date()) {
      throw new BadRequestException('Buffer window has expired');
    }

    const updatedRefund = await this.prisma.adminRefundRequest.update({
      where: { id: refundId },
      data: {
        status: AdminRefundStatus.REVERT_REQUESTED,
        revertReason: reason,
        revertRequestedById: requesterId,
        revertRequestedAt: new Date(),
        bufferExpiresAt: null,
      },
      include: this.refundInclude(),
    });

    await this.supportQueue.cancelRefundFinalization(refundId);

    this.notificationsService
      .sendNotification(
        {
          title: 'Refund revert requested',
          message: `Refund revert requested for Booking #${refund.booking.bookingNumber.toString()}`,
          entityId: refundId,
          entityType: 'REFUND',
          actionUrl: `/support/refunds/${refundId}`,
        },
        {
          roles: [AdminRole.ADMIN, AdminRole.SUPER_ADMIN],
          useTopic: true,
          topic: AdminFcmTopic.REFUND_REVERT_REQUESTS,
          event: AdminNotificationEvent.REFUND_REVERT_REQUESTED,
        },
      )
      .catch((error) => {
        this.logger.error(`Failed to broadcast refund revert request for ${refundId}`, error);
      });

    return {
      ...this.decorateRefund(updatedRefund),
      [AUDIT_METADATA_KEY]: {
        beforeSnapshot: {
          refundId,
          status: refund.status,
          bufferExpiresAt: refund.bufferExpiresAt,
        },
        afterSnapshot: {
          refundId,
          status: updatedRefund.status,
          bufferExpiresAt: null,
          revertReason: updatedRefund.revertReason,
          requestedByRole: requesterRole,
        },
        entityId: refundId,
      },
    };
  }

  private refundInclude(mode: 'full' | 'minimal' = 'full'): Prisma.AdminRefundRequestInclude {
    if (mode === 'minimal') {
      // For getBookingDetails - don't include booking/customer/driver (already fetched)
      return {
        createdBy: true,
        approvedBy: true,
        revertRequestedBy: true,
      };
    }

    // For standalone queries - include everything
    return {
      booking: {
        include: {
          customer: true,
          assignedDriver: true,
          package: true,
          pickupAddress: true,
          dropAddress: true,
          invoices: true,
          statusLogs: {
            orderBy: { statusChangedAt: 'asc' },
          },
        },
      },
      customer: true,
      driver: true,
      createdBy: true,
      approvedBy: true,
      revertRequestedBy: true,
    };
  }

  private decorateRefund<T extends { status: AdminRefundStatus; bufferExpiresAt: Date | null }>(refund: T) {
    const isInBuffer =
      refund.status === AdminRefundStatus.APPROVED &&
      !!refund.bufferExpiresAt &&
      refund.bufferExpiresAt > new Date();

    return {
      ...refund,
      isInBuffer,
      bufferRemainingMinutes:
        refund.bufferExpiresAt && isInBuffer
          ? Math.max(0, Math.ceil((refund.bufferExpiresAt.getTime() - Date.now()) / 60000))
          : 0,
    };
  }
}
