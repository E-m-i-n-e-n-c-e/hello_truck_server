import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Booking, BookingStatus, AssignmentStatus, DriverStatus, VerificationStatus, Address, BookingAssignment, Package } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { BookingInvoiceService } from '../services/booking-invoice.service';
import { BookingNotificationService } from '../services/booking-notification.service';

type AssignJobData = { bookingId: string; attempt: number };
type TimeoutJobData = { bookingId: string; driverId: string };
type BookingDetails = Booking & { pickupAddress: Address; assignments: BookingAssignment[]; package: Package };

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  private readonly OFFER_TIMEOUT_MS = 45_000; // 45s
  private readonly FINALIZE_AFTER_MS = 300_000; // 5m

  private readonly BASE_RADIUS_KM = 5;
  private readonly RADIUS_STEP_KM = 1;
  private readonly MAX_ATTEMPTS = 12;
  private readonly ATTEMPT_DELAY_MS = 8000; // 8s

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly bookingInvoiceService: BookingInvoiceService,
    private readonly bookingNotificationService: BookingNotificationService,
    @InjectQueue('booking-assignment') private readonly assignmentQueue: Queue,
  ) {}

  async onBookingCreated(bookingId: string) {
    this.logger.log(`[onBookingCreated] Booking created: ${bookingId}`);
    await this.addAssignJob({ bookingId, attempt: 1 });
  }

  async onDriverAccept(bookingId: string, driverId: string) {
    this.logger.log(`[onDriverAccept] Driver ${driverId} accepted booking ${bookingId}. Cancelling timeout and assignment jobs.`);
    await this.cancelTimeoutJob(bookingId);
    await this.cancelAssignJob(bookingId);
  }

  async onDriverReject(bookingId: string, driverId: string) {
    this.logger.log(`[onDriverReject] Driver ${driverId} rejected booking ${bookingId}. Cancelling timeout and re-queuing assignment.`);
    await this.cancelTimeoutJob(bookingId);
    const attempt = await this.getAttempt(bookingId);
    this.logger.log(`[onDriverReject] Current attempt for booking ${bookingId}: ${attempt}`);
    await this.addAssignJob({ bookingId, attempt: attempt });
  }

  async onBookingCancelled(bookingId: string) {
    this.logger.log(`[onBookingCancelled] Booking ${bookingId} cancelled. Cancelling any pending jobs.`);
    await this.cancelTimeoutJob(bookingId);
    await this.cancelAssignJob(bookingId);
  }

  async tryToAssignDriver(job: Job<AssignJobData>) {
    const { bookingId, attempt } = job.data;
    let assignedDriverId: string | null = null;

    // Acquire lock before processing
    const lockKey = `booking:${bookingId}:processing`;
    const lockAcquired = await this.redisService.set(lockKey, '1', 'EX', 30, 'NX');

    if (!lockAcquired) {
      this.logger.log(`[tryToAssignDriver] Another job is processing booking ${bookingId}. Skipping.`);
      return;
    }

    try {
      this.logger.log(`[tryToAssignDriver] Attempting to assign driver for booking ${bookingId}, attempt ${attempt}`);

      await this.prisma.$transaction(async (tx) => {
        const booking = await this.retrieveBookingDetails(bookingId, tx);
        if (!booking) {
          this.logger.warn(`[tryToAssignDriver] Booking ${bookingId} not found or not pending.`);
          return;
        }

        const acceptedOrAssigned = booking.assignments.some((a) => a.status === AssignmentStatus.ACCEPTED || a.status === AssignmentStatus.OFFERED);
        if (acceptedOrAssigned) {
          this.logger.log(`[tryToAssignDriver] Booking ${bookingId} already has an accepted or offered assignment. Skipping.`);
          return;
        }

        const timeSinceBooking = Date.now() - booking.createdAt.getTime();
        if (timeSinceBooking > this.FINALIZE_AFTER_MS || attempt >= this.MAX_ATTEMPTS) {
          this.logger.warn(`[tryToAssignDriver] Booking ${bookingId} expired (timeSinceBooking: ${timeSinceBooking}ms, attempt: ${attempt}). Marking as expired.`);
          await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.EXPIRED } });
          return;
        }

        const radiusKm = this.BASE_RADIUS_KM + Math.floor((attempt - 1)/2) * this.RADIUS_STEP_KM;
        this.logger.log(`[tryToAssignDriver] Using search radius: ${radiusKm}km for booking ${bookingId}, attempt ${attempt}`);

        const exclude = new Set(booking.assignments.map((a) => a.driverId));
        this.logger.log(`[tryToAssignDriver] Excluding drivers: ${Array.from(exclude).join(', ') || '(none)'}`);

        const next = await this.pickBestCandidate(booking, radiusKm, exclude);
        if (!next) {
          this.logger.log(`[tryToAssignDriver] No suitable driver found for booking ${bookingId} at attempt ${attempt}. Re-queuing with delay.`);
          await this.addAssignJob({ bookingId, attempt: attempt + 1 }, this.ATTEMPT_DELAY_MS);
          return;
        }

        this.logger.log(`[tryToAssignDriver] Assigning driver ${next.driverId} (score: ${next.driverScore}, distance: ${next.distanceKm}km, combinedScore: ${next.combinedScore}) to booking ${bookingId}`);
        await this.setAttempt(bookingId, attempt);
        assignedDriverId = await this.assignDriverTx(bookingId, next.driverId, tx);
      });
    } finally {
      await this.redisService.del(lockKey);
      if(assignedDriverId) {
        this.logger.log(`[tryToAssignDriver] Notifying driver ${assignedDriverId} of assignment for booking ${bookingId}.`);
        await this.bookingNotificationService.notifyDriverAssignmentOffered(assignedDriverId, bookingId);
      }
    }
  }

  async timeoutDriver(job: Job<TimeoutJobData>) {
    const { bookingId, driverId } = job.data;
    this.logger.log(`[timeoutDriver] Timeout for driver ${driverId} on booking ${bookingId}. Marking as auto-rejected and re-queuing assignment.`);
    await this.prisma.$transaction(async (tx) => {
      const updatedAssignments = await tx.bookingAssignment.updateMany({
        where: { bookingId, driverId, status: AssignmentStatus.OFFERED },
        data: { status: AssignmentStatus.AUTO_REJECTED, respondedAt: new Date() },
      });
      this.logger.log(`[timeoutDriver] Updated ${updatedAssignments.count} bookingAssignment(s) to AUTO_REJECTED for driver ${driverId} on booking ${bookingId}.`);

      const updatedBookings = await tx.booking.updateMany({
        where: { id: bookingId, assignedDriverId: driverId, status: BookingStatus.DRIVER_ASSIGNED },
        data: { assignedDriverId: null, status: BookingStatus.PENDING },
      });
      this.logger.log(`[timeoutDriver] Updated ${updatedBookings.count} booking(s) to PENDING for booking ${bookingId}.`);

      const updatedDrivers = await tx.driver.updateMany({
        where: { id: driverId, driverStatus: DriverStatus.RIDE_OFFERED },
        data: { driverStatus: DriverStatus.AVAILABLE },
      });
      this.logger.log(`[timeoutDriver] Updated ${updatedDrivers.count} driver(s) to AVAILABLE for driver ${driverId}.`);
    });

    const attempt = await this.getAttempt(bookingId);
    this.logger.log(`[timeoutDriver] Re-queuing assignment for booking ${bookingId} at attempt ${attempt}.`);
    this.bookingNotificationService.notifyDriverAssigmentTimeout(driverId, bookingId);
    await this.addAssignJob({ bookingId, attempt: attempt });
  }

  private assignJobId(bookingId: string, attempt: number) {
    return `assign:${bookingId}:${attempt}`;
  }
  private timeoutJobId(bookingId: string) {
    return `timeout:${bookingId}`;
  }

  private async addAssignJob(data: AssignJobData, delayMs = 0) {
    const jobId = this.assignJobId(data.bookingId, data.attempt);
    this.logger.log(`[addAssignJob] Adding assignment job for booking ${data.bookingId} (attempt: ${data.attempt}, delay: ${delayMs}ms, jobId: ${jobId})`);

    const job = await this.assignmentQueue.add('assign-driver', data, {
      jobId,
      delay: delayMs,
    });

    this.logger.log(`[addAssignJob] Job added successfully with ID: ${job.id}`);
  }

  private async scheduleTimeoutJob(bookingId: string, driverId: string) {
    this.logger.log(`[scheduleTimeoutJob] Scheduling timeout job for booking ${bookingId}, driver ${driverId} (timeout: ${this.OFFER_TIMEOUT_MS}ms)`);
    await this.assignmentQueue.add('timeout-driver', { bookingId, driverId }, {
      jobId: this.timeoutJobId(bookingId),
      delay: this.OFFER_TIMEOUT_MS,
    });
  }

  private async cancelTimeoutJob(bookingId: string) {
    const jobId = this.timeoutJobId(bookingId);
    const job = await this.assignmentQueue.getJob(jobId);
    if (job) {
      this.logger.log(`[cancelTimeoutJob] Cancelling timeout job for booking ${bookingId} (jobId: ${jobId})`);
      try {
        await job.remove();
      } catch (error) {
        this.logger.warn(`[cancelTimeoutJob] Failed to remove job ${jobId}: ${error.message}`);
      }
    } else {
      this.logger.log(`[cancelTimeoutJob] No timeout job found for booking ${bookingId} (jobId: ${jobId})`);
    }
  }

  private async cancelAssignJob(bookingId: string) {
    const jobs = await this.assignmentQueue.getJobs(['waiting', 'active', 'delayed']);
    const jobsToCancel = jobs.filter(job =>
      job && job.name === 'assign-driver' && job.data.bookingId === bookingId
    );

    if (jobsToCancel.length > 0) {
      // Use Promise.all to send all remove requests in parallel (single network round-trip for Redis)
      await Promise.all(jobsToCancel.map(async (job) => {
        try {
          await job.remove();
        } catch (error) {
          this.logger.warn(`[cancelAssignJob] Failed to remove job ${job.id}: ${error.message}`);
        }
      }));
    }
  }

  private async getAttempt(bookingId: string): Promise<number> {
    const key = `booking:${bookingId}:assignment_attempt`;
    const val = await this.redisService.get(key);
    this.logger.log(`[getAttempt] Retrieved attempt value for booking ${bookingId}: ${val}`);
    return val ? parseInt(val) : 1;
  }

  private async setAttempt(bookingId: string, attempt: number) {
    const key = `booking:${bookingId}:assignment_attempt`;
    this.logger.log(`[setAttempt] Setting attempt value for booking ${bookingId} to ${attempt} (key: ${key})`);
    await this.redisService.set(key, attempt, 'EX', 3600); // 1 hour expiry
  }

  private async assignDriverTx(bookingId: string, driverId: string, tx: Prisma.TransactionClient) : Promise<string> {
    this.logger.log(`[assignDriverTx] Assigning driver ${driverId} to booking ${bookingId}. Creating assignment and updating statuses.`);
    await tx.bookingAssignment.create({
      data: { bookingId, driverId, status: AssignmentStatus.OFFERED, offeredAt: new Date() },
    });
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.DRIVER_ASSIGNED, assignedDriverId: driverId },
    });
    await tx.driver.update({ where: { id: driverId }, data: { driverStatus: DriverStatus.RIDE_OFFERED } });
    await this.scheduleTimeoutJob(bookingId, driverId);
    return driverId;
  }

  private async retrieveBookingDetails(
    bookingId: string,
    tx: Prisma.TransactionClient
  ): Promise<BookingDetails | null> {
    this.logger.log(`[retrieveBookingDetails] Retrieving booking details for booking ${bookingId}.`);
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, status: { in: [BookingStatus.PENDING] } },
      include: { pickupAddress: true, assignments: true, package: true },
    });
    if (!booking) {
      this.logger.warn(`[retrieveBookingDetails] Booking ${bookingId} not found or not pending.`);
    }
    return booking;
  }

  private async pickBestCandidate(
    booking: BookingDetails,
    radiusKm: number,
    excludeDriverIds: Set<string>,
  ): Promise<{ driverId: string; distanceKm: number; driverScore: number; combinedScore: number } | null> {
    const lat = Number(booking.pickupAddress.latitude);
    const lng = Number(booking.pickupAddress.longitude);

    this.logger.log(`[pickBestCandidate] Searching for drivers within ${radiusKm}km of (${lat}, ${lng}) for booking ${booking.id}. Excluding: ${Array.from(excludeDriverIds).join(', ') || '(none)'}`);

    // Calculate required weight capacity from package
    const weightInTons = this.bookingInvoiceService.calculateTotalWeightInTons(booking.package);
    this.logger.log(`[pickBestCandidate] Required weight capacity: ${weightInTons} tons for booking ${booking.id}`);

    const rawNearby = (await this.redisService.georadius('active_drivers', lng, lat, radiusKm, 'km', 'WITHDIST')) as [string, string][];

    const keys = rawNearby.map(([id]) => `driver:${id}:lastSeen`);
    const existsList = keys.length > 0 ? await this.redisService.mget(keys) : [];

    // 4. Filter out expired drivers
    const filteredNearby = rawNearby.filter((_, idx) => existsList[idx] !== null);
    this.logger.log(`[pickBestCandidate] Found ${filteredNearby.length} nearby drivers in Redis for booking ${booking.id}.`);
    const nearbyMap = new Map(filteredNearby.map(([id, dist]) => [id, Number(dist)]));
    const filteredDriverIds = Array.from(nearbyMap.keys()).filter((id) => !excludeDriverIds.has(id));
    this.logger.log(`[pickBestCandidate] Filtered to ${filteredDriverIds.length} drivers after exclusion for booking ${booking.id}.`);

    if (filteredDriverIds.length === 0) {
      this.logger.log(`[pickBestCandidate] No drivers available after filtering for booking ${booking.id}.`);
      return null;
    }

    // Fetch drivers with vehicle and vehicleModel
    const drivers = await this.prisma.driver.findMany({
      where: {
        id: { in: filteredDriverIds },
        isActive: true,
        verificationStatus: VerificationStatus.VERIFIED,
        driverStatus: DriverStatus.AVAILABLE,
      },
      include: {
        vehicle: {
          include: {
            vehicleModel: true,
          },
        },
      },
    });
    this.logger.log(`[pickBestCandidate] Found ${drivers.length} eligible drivers in DB for booking ${booking.id}.`);

    if (drivers.length === 0) {
      this.logger.log(`[pickBestCandidate] No eligible drivers found in DB for booking ${booking.id}.`);
      return null;
    }

    // Filter drivers by weight capacity
    const suitableDrivers = drivers.filter((driver) => {
      if (!driver.vehicle || !driver.vehicle.vehicleModel) {
        this.logger.warn(`[pickBestCandidate] Driver ${driver.id} has no vehicle or vehicle model`);
        return false;
      }

      const maxWeightTons = Number(driver.vehicle.vehicleModel.maxWeightTons);
      const canHandle = maxWeightTons >= weightInTons;

      return canHandle;
    });

    this.logger.log(`[pickBestCandidate] Found ${suitableDrivers.length} drivers with suitable weight capacity for booking ${booking.id}.`);

    if (suitableDrivers.length === 0) {
      this.logger.log(`[pickBestCandidate] No drivers with sufficient weight capacity for booking ${booking.id}.`);
      return null;
    }

    const ranked = suitableDrivers
      .map((d) => {
        const distanceKm = nearbyMap.get(d.id) ?? radiusKm * 100;
        const combinedScore = 0.7 * distanceKm - 0.3 * (d.score / 10);
        this.logger.log(`[pickBestCandidate] Driver ${d.id}: score=${d.score}, distanceKm=${distanceKm}, combinedScore=${combinedScore}`);
        return { id: d.id, score: d.score, distanceKm, combinedScore };
      })
      .sort((a, b) => a.combinedScore - b.combinedScore);

    const best = ranked[0];
    this.logger.log(`[pickBestCandidate] Best candidate for booking ${booking.id}: driverId=${best.id}, score=${best.score}, distanceKm=${best.distanceKm}, combinedScore=${best.combinedScore}`);

    return {
      driverId: best.id,
      driverScore: best.score,
      distanceKm: best.distanceKm,
      combinedScore: best.combinedScore,
    };
  }
}