import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { Address, AssignmentStatus, Booking, BookingStatus, DriverStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FcmEventType } from 'src/common/types/fcm.types';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import * as crypto from 'crypto';

@Injectable()
export class BookingAssignmentService {
  private readonly logger = new Logger(BookingAssignmentService.name);

  private readonly OFFER_TIMEOUT_MS = 45_000;   // 45s
  private readonly ESCALATE_AFTER_MS = 120_000;    // 2m
  private readonly FINALIZE_AFTER_MS = 300_000; // 5m

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  // Process all pending bookings every 10 seconds
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processAllPendingBookings() {
    const pendingBookings = await this.prisma.booking.findMany({
      where: {
        status: {
          in: [BookingStatus.PENDING, BookingStatus.DRIVER_ASSIGNED]
        },
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 1) // 1 hour
        }
      },
      select: { id: true }
    });

    for (const booking of pendingBookings) {
      try {
        await this.advance(booking.id);
      } catch (error) {
        this.logger.error(`Failed to advance booking ${booking.id}:`, error);
      }
    }
  }

  // Idempotent step: call on create and then periodically via cron
  async advance(bookingId: string) {
    await this.prisma.$transaction(async (tx) => {
      const booking = await this.lockAndRetrieveBooking(bookingId, tx);
      if (!booking) return;

      // If already accepted → done
      const accepted = await tx.bookingAssignment.findFirst({
        where: { bookingId, status: AssignmentStatus.ACCEPTED },
        select: { id: true },
      });
      if (accepted) return;

      const timeSinceBooking = Date.now() - booking.createdAt.getTime();
      if (timeSinceBooking > this.FINALIZE_AFTER_MS) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.EXPIRED },
        });
        return;
      }

      const assignments = await tx.bookingAssignment.findMany({
        where: { bookingId },
        orderBy: { offeredAt: 'asc' },
        select: { id: true, driverId: true, status: true, offeredAt: true },
      });

      if (assignments.length === 0) {
        // no offers yet, start with first one
        const radiusKm = timeSinceBooking > this.ESCALATE_AFTER_MS ? 10 : 5;
        const next = await this.pickBestCandidate(booking, radiusKm, new Set());
        if (!next) return;
        await this.assignDriver(bookingId, next.driverId, tx);
        return;
      }

      const last = assignments[assignments.length - 1];
      const lastOfferedAt = last.offeredAt;
      const elapsedMs = Date.now() - lastOfferedAt.getTime();

      if (last.status === AssignmentStatus.OFFERED) {
        // If last offer is still pending, return early
        if (elapsedMs < this.OFFER_TIMEOUT_MS) {
          return;
        }

        // Auto-reject offer that has exceeded timeout
        await tx.bookingAssignment.updateMany({
          where: { id: last.id, status: AssignmentStatus.OFFERED },
          data: { status: AssignmentStatus.AUTO_REJECTED, respondedAt: new Date() },
        });
      }

      // Pick next candidate excluding already offered drivers
      const alreadyOffered = new Set(assignments.map(a => a.driverId));
      const radiusKm = elapsedMs > this.ESCALATE_AFTER_MS ? 10 : 5;
      const next = await this.pickBestCandidate(booking, radiusKm, alreadyOffered);
      if (!next) return; // nothing to offer in this step

      await this.assignDriver(bookingId, next.driverId, tx);
    });
  }

  private async pickBestCandidate(
    booking: Booking & { pickupAddress: { latitude: Decimal; longitude: Decimal } },
    radiusKm: number,
    excludeDriverIds: Set<string>,
  ): Promise<{ driverId: string; distanceKm: number; driverScore: number; combinedScore: number } | null> {
    const lat = Number(booking.pickupAddress.latitude);
    const lng = Number(booking.pickupAddress.longitude);

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT d.id as "driverId",
             d.score as "driverScore",
             d.latitude as "driverLatitude",
             d.longitude as "driverLongitude",
             distance_km AS "distanceKm",
             (distance_km * 0.7) + (100 - LEAST(GREATEST(d.score, 0), 100)) * 0.3 AS "combinedScore"
      FROM (
        SELECT d.id,
               d.score,
               d.latitude,
               d.longitude,
               6371 * acos(
                 cos(radians(${lat})) * cos(radians(CAST(d.latitude AS double precision))) *
                 cos(radians(CAST(d.longitude AS double precision)) - radians(${lng})) +
                 sin(radians(${lat})) * sin(radians(CAST(d.latitude AS double precision)))
               ) AS distance_km
        FROM "Driver" d
        WHERE d."isActive" = true
          AND d."verificationStatus" = 'VERIFIED'
          AND d."driverStatus" = 'AVAILABLE'
          AND d.latitude IS NOT NULL
          AND d.longitude IS NOT NULL
          AND d.lastSeenAt > NOW() - INTERVAL '1 minute'
          AND d.id <> ALL(${Array.from(excludeDriverIds)})
      ) sub
      WHERE distance_km <= ${radiusKm}
      ORDER BY "combinedScore" ASC
      LIMIT 1;
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      driverId: row.driverId as string,
      distanceKm: Number(row.distanceKm),
      driverScore: Number(row.driverScore) || 0,
      combinedScore: Number(row.combinedScore),
    };
  }

  async assignDriver(bookingId: string, driverId: string, tx: Prisma.TransactionClient): Promise<void> {
      // Create booking assignment
    await tx.bookingAssignment.create({
      data: {
        bookingId,
        driverId,
        status: AssignmentStatus.OFFERED,
        offeredAt: new Date(),
      }
    });

    // Update booking status and assign driver
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.DRIVER_ASSIGNED,
        assignedDriverId: driverId,
      }
    });

    // Update driver status to RIDE_OFFERED
    await tx.driver.update({
      where: { id: driverId },
      data: { driverStatus: DriverStatus.RIDE_OFFERED }
    });

    await this.firebase.notifyAllSessions(driverId, 'driver', {
      data: { event: FcmEventType.DriverAssignmentOffered, bookingId },
    });
  }

  private async lockAndRetrieveBooking(bookingId: string, tx: Prisma.TransactionClient): Promise<Booking & { pickupAddress: Address } | null> {
    // Try to acquire advisory lock for this booking
    const gotLock = await tx.$queryRaw<{ pg_try_advisory_xact_lock: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${this.hashToBigInt(bookingId)}) AS pg_try_advisory_xact_lock
    `;

    if (!gotLock[0]?.pg_try_advisory_xact_lock) {
      // Another transaction is already processing this booking
      return null;
    }

    return tx.booking.findFirst({
      where: {
        id: bookingId,
        status: { in: [BookingStatus.PENDING, BookingStatus.DRIVER_ASSIGNED] }
      },
      include: { pickupAddress: true },
    });
  }

  private hashToBigInt(input: string): bigint {
    const hash = crypto.createHash("sha256").update(input).digest();

    // Take the first 8 bytes as a signed 64-bit integer
    const value = hash.readBigInt64BE(0);

    return value;
  }
}
