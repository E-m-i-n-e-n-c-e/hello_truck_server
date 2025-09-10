import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Booking, BookingStatus, AssignmentStatus, DriverStatus, VerificationStatus, Address, BookingAssignment } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import { FcmEventType } from 'src/common/types/fcm.types';
import { RedisService } from 'src/redis/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';

type AssignJobData = { bookingId: string; attempt: number };
type TimeoutJobData = { bookingId: string; driverId: string };
type BookingDetails = Booking & { pickupAddress: Address; assignments: BookingAssignment[] };

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
    private readonly firebase: FirebaseService,
    private readonly redisService: RedisService,
    @InjectQueue('booking-assignment') private readonly queue: Queue,
  ) {}

  async onBookingCreated(bookingId: string) {
    await this.addAssignJob({ bookingId, attempt: 1 });
  }

  async onDriverAccept(bookingId: string, driverId: string) {
    // Upstream service already updated DB state; just cancel timeout and assign job
    await this.cancelTimeoutJob(bookingId);
    await this.cancelAssignJob(bookingId);
  }

  async onDriverReject(bookingId: string, driverId: string) {
    // Upstream service already updated DB state; cancel timeout and re-queue
    await this.cancelTimeoutJob(bookingId);
    const attempt = await this.getAttempt(bookingId);
    await this.addAssignJob({ bookingId, attempt: attempt });
  }

  async onBookingCancelled(bookingId: string) {
    // Cancel any pending timeout and assignment jobs
    await this.cancelTimeoutJob(bookingId);
    await this.cancelAssignJob(bookingId);
  }

  async tryToAssignDriver(job: Job<AssignJobData>) {
    const { bookingId, attempt } = job.data;
    await this.prisma.$transaction(async (tx) => {
      const booking = await this.retrieveBookingDetails(bookingId, tx);
      if (!booking) return;

      const acceptedOrAssigned = booking.assignments.some((a) => a.status === AssignmentStatus.ACCEPTED || a.status === AssignmentStatus.OFFERED);
      if (acceptedOrAssigned) return;

      const timeSinceBooking = Date.now() - booking.createdAt.getTime();
      if (timeSinceBooking > this.FINALIZE_AFTER_MS || attempt >= this.MAX_ATTEMPTS) {
        await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.EXPIRED } });
        return;
      }

      const radiusKm = this.BASE_RADIUS_KM + Math.floor((attempt - 1)/2) * this.RADIUS_STEP_KM;

      const exclude = new Set(booking.assignments.map((a) => a.driverId));

      const next = await this.pickBestCandidate(booking, radiusKm, exclude);
      if (!next) {
        await this.addAssignJob({ bookingId, attempt: attempt + 1 }, this.ATTEMPT_DELAY_MS);
        return;
      }

      await this.setAttempt(bookingId, attempt);
      await this.assignDriverTx(bookingId, next.driverId, tx);
    });
  }

  async timeoutDriver(job: Job<TimeoutJobData>) {
    const { bookingId, driverId } = job.data;
    await this.prisma.$transaction(async (tx) => {
      await tx.bookingAssignment.updateMany({
        where: { bookingId, driverId, status: AssignmentStatus.OFFERED },
        data: { status: AssignmentStatus.AUTO_REJECTED, respondedAt: new Date() },
      });
      await tx.booking.updateMany({
        where: { id: bookingId, assignedDriverId: driverId, status: BookingStatus.DRIVER_ASSIGNED },
        data: { assignedDriverId: null, status: BookingStatus.PENDING },
      });
      await tx.driver.updateMany({
        where: { id: driverId, driverStatus: DriverStatus.RIDE_OFFERED },
        data: { driverStatus: DriverStatus.AVAILABLE },
      });
    });

    const attempt = await this.getAttempt(bookingId);
    await this.addAssignJob({ bookingId, attempt: attempt });
  }

  private assignJobId(bookingId: string) {
    return `assign:${bookingId}`;
  }
  private timeoutJobId(bookingId: string) {
    return `timeout:${bookingId}`;
  }

  private async addAssignJob(data: AssignJobData, delayMs = 0) {
    const jobId = this.assignJobId(data.bookingId);
    const existing = await this.queue.getJob(jobId);
    if (existing) return;
    await this.queue.add('assign-driver', data, {
      jobId,
      delay: delayMs,
      removeOnComplete: true,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  private async scheduleTimeoutJob(bookingId: string, driverId: string) {
    await this.queue.add('timeout-driver', { bookingId, driverId }, {
      jobId: this.timeoutJobId(bookingId),
      delay: this.OFFER_TIMEOUT_MS,
      removeOnComplete: true,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  private async cancelTimeoutJob(bookingId: string) {
    const job = await this.queue.getJob(this.timeoutJobId(bookingId));
    if (job) await job.remove();
  }

  private async cancelAssignJob(bookingId: string) {
    const job = await this.queue.getJob(this.assignJobId(bookingId));
    if (job) await job.remove();
  }

  private async getAttempt(bookingId: string): Promise<number> {
    const val = await this.redisService.get(`booking:${bookingId}:assignment_attempt`);
    return val ? parseInt(val) : 1;
  }

  private async setAttempt(bookingId: string, attempt: number) {
    await this.redisService.set(`booking:${bookingId}:assignment_attempt`, attempt, 'EX', 3600); // 1 hour expiry
  }

  private async assignDriverTx(bookingId: string, driverId: string, tx: Prisma.TransactionClient) {
    await tx.bookingAssignment.create({
      data: { bookingId, driverId, status: AssignmentStatus.OFFERED, offeredAt: new Date() },
    });
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.DRIVER_ASSIGNED, assignedDriverId: driverId },
    });
    await tx.driver.update({ where: { id: driverId }, data: { driverStatus: DriverStatus.RIDE_OFFERED } });
    await this.firebase.notifyAllSessions(driverId, 'driver', {
      data: { event: FcmEventType.DriverAssignmentOffered, bookingId },
    });
    await this.scheduleTimeoutJob(bookingId, driverId);
  }

  private async retrieveBookingDetails(
    bookingId: string,
    tx: Prisma.TransactionClient
  ): Promise<BookingDetails | null> {
    return tx.booking.findFirst({
      where: { id: bookingId, status: { in: [BookingStatus.PENDING] } },
      include: { pickupAddress: true, assignments: true },
    });
  }

  private async pickBestCandidate(
    booking: BookingDetails,
    radiusKm: number,
    excludeDriverIds: Set<string>,
  ): Promise<{ driverId: string; distanceKm: number; driverScore: number; combinedScore: number } | null> {
    const lat = Number(booking.pickupAddress.latitude);
    const lng = Number(booking.pickupAddress.longitude);

    const rawNearby = (await this.redisService.georadius('active_drivers', lng, lat, radiusKm, 'km', 'WITHDIST')) as [string, string][];
    const nearbyMap = new Map(rawNearby.map(([id, dist]) => [id, Number(dist)]));
    const filteredDriverIds = Array.from(nearbyMap.keys()).filter((id) => !excludeDriverIds.has(id));
    if (filteredDriverIds.length === 0) return null;

    const drivers = await this.prisma.driver.findMany({
      where: {
        id: { in: filteredDriverIds },
        isActive: true,
        verificationStatus: VerificationStatus.VERIFIED,
        driverStatus: DriverStatus.AVAILABLE,
        lastSeenAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
    });
    if (drivers.length === 0) return null;

    const ranked = drivers
      .map((d) => {
        const distanceKm = nearbyMap.get(d.id) ?? radiusKm * 100;
        const combinedScore = 0.7 * distanceKm - 0.3 * (d.score / 10);
        return { id: d.id, score: d.score, distanceKm, combinedScore };
      })
      .sort((a, b) => a.combinedScore - b.combinedScore);

    return {
      driverId: ranked[0].id,
      driverScore: ranked[0].score,
      distanceKm: ranked[0].distanceKm,
      combinedScore: ranked[0].combinedScore,
    };
  }
}


