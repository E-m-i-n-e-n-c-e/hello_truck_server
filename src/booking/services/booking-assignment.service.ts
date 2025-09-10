import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Address, AssignmentStatus, Booking, BookingStatus, DriverStatus, Prisma, VerificationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FcmEventType } from 'src/common/types/fcm.types';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import * as crypto from 'crypto';
import { RedisService } from 'src/redis/redis.service';
import { Job, Queue, Worker } from 'bullmq';

@Injectable()
export class BookingAssignmentService {
  private readonly logger = new Logger(BookingAssignmentService.name);

  private readonly OFFER_TIMEOUT_MS = 45_000;   // 45s
  private readonly ESCALATE_AFTER_MS = 120_000;    // 2m
  private readonly FINALIZE_AFTER_MS = 300_000; // 5m

  private readonly queue: Queue;
  private readonly worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly redisService: RedisService,
  ) {
    this.queue = new Queue('booking-assignment', {
      connection: this.redisService,
    });

    // Create worker to process jobs
    this.worker = new Worker('booking-assignment', async (job: Job<{ bookingId: string }>) => {
      await this.processJob(job);
    }, {
      connection: this.redisService,
      concurrency: 5, // Process 5 jobs concurrently
    });
  }

  // Process job from queue
  private async processJob(job: Job<{ bookingId: string }>) {
    const { name, data } = job;
    if (name === 'advance-booking') {
      await this.advance(data.bookingId);
    }
  }

  // Idempotent step: call once per booking
  async advance(bookingId: string, scheduleNext: boolean = true) {
    await this.prisma.$transaction(async (tx) => {
      const booking = await this.lockAndRetrieveBooking(bookingId, tx, scheduleNext);
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
        if (!next) {
          // No driver found, schedule retry
          if (scheduleNext) {
            await this.scheduleRetry(bookingId);
          }
          return;
        }
        try {
          await this.assignDriver(bookingId, next.driverId, tx);
        } catch (error) {
          // Schedule next check if error
          if (scheduleNext) {
            await this.scheduleRetry(bookingId);
          }
          this.logger.error(`Error assigning driver ${next.driverId} to booking ${bookingId}:`, error);
        }
        return;
      }

      const last = assignments[assignments.length - 1];
      const lastOfferedAt = last.offeredAt;
      const elapsedMs = Date.now() - lastOfferedAt.getTime();

      if (last.status === AssignmentStatus.OFFERED) {
        // If last offer is still pending, schedule next check and return
        if (elapsedMs < this.OFFER_TIMEOUT_MS) {
          if (scheduleNext) {
            await this.scheduleRetry(bookingId);
          }
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
      if (!next) {
        // No more drivers, schedule retry
        if (scheduleNext) {
          await this.scheduleRetry(bookingId);
        }
        return;
      }

      try {
        await this.assignDriver(bookingId, next.driverId, tx);
      } catch (error) {
        // Schedule next check if error
        if (scheduleNext) {
          await this.scheduleRetry(bookingId);
        }
        this.logger.error(`Error assigning driver ${next.driverId} to booking ${bookingId}:`, error);
      }
    });
  }

  // Schedule retry with delay
  private async scheduleRetry(bookingId: string) {
    await this.queue.add('advance-booking', {
      bookingId
    }, { delay: 5000 }); // 5 second delay
  }

  private async pickBestCandidate(
    booking: Booking & { pickupAddress: { latitude: Decimal; longitude: Decimal } },
    radiusKm: number,
    excludeDriverIds: Set<string>,
  ): Promise<{ driverId: string; distanceKm: number; driverScore: number; combinedScore: number } | null> {
    const lat = Number(booking.pickupAddress.latitude);
    const lng = Number(booking.pickupAddress.longitude);

    const rawNearby = await this.redisService.georadius('active_drivers', lng, lat, radiusKm, 'km', 'WITHDIST') as [string, string][];
    const nearbyMap = new Map(rawNearby.map(([id, dist]) => [id, Number(dist)]));

    // Exclude already offered drivers
    const filteredDriverIds = Array.from(nearbyMap.keys()).filter(id => !excludeDriverIds.has(id));

    if (filteredDriverIds.length === 0) return null;

    // Step 2: Fetch driver metadata from Postgres
    const drivers = await this.prisma.driver.findMany({
      where: {
        id: { in: filteredDriverIds },
        isActive: true,
        verificationStatus: VerificationStatus.VERIFIED,
        driverStatus: DriverStatus.AVAILABLE,
        lastSeenAt: { gte: new Date(Date.now() - 60 * 1000) }, // last 1 min
      },
    });

    if (drivers.length === 0) return null;

    // Step 3: Map distances to drivers
    const driversWithDistance = drivers.map(d => {
      const distanceKm = nearbyMap.get(d.id) ?? radiusKm * 100;
      const combinedScore = 0.7 * distanceKm - 0.3 * (d.score / 10);
      return { ...d, distanceKm, combinedScore};
    });

    // Step 4: Sort by combined score (lower distance, higher score)
    driversWithDistance.sort((a, b) => {
      return a.combinedScore - b.combinedScore;
    });

    return {
      driverId: driversWithDistance[0].id,
      driverScore: driversWithDistance[0].score,
      distanceKm: driversWithDistance[0].distanceKm,
      combinedScore: driversWithDistance[0].combinedScore,
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

  private async lockAndRetrieveBooking(bookingId: string, tx: Prisma.TransactionClient, scheduleNext: boolean): Promise<Booking & { pickupAddress: Address } | null> {
    // Try to acquire advisory lock for this booking
    const gotLock = await tx.$queryRaw<{ pg_try_advisory_xact_lock: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${this.hashToBigInt(bookingId)}) AS pg_try_advisory_xact_lock
    `;

    if (!gotLock[0]?.pg_try_advisory_xact_lock) {
      // Another transaction is already processing this booking. Schedule retry.
      if(scheduleNext) {
        await this.scheduleRetry(bookingId);
      }
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
