import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentCleanupService } from './services/document-cleanup.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { DriverCleanupService } from './services/driver-cleanup.service';
import { BookingCleanupService } from './services/booking-cleanup.service';
import { LogCleanupService } from './services/log-cleanup.service';
import { PayoutService } from './services/payout.service';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor(
    private documentCleanup: DocumentCleanupService,
    private sessionCleanup: SessionCleanupService,
    private driverCleanup: DriverCleanupService,
    private bookingCleanup: BookingCleanupService,
    private logCleanup: LogCleanupService,
    private payoutService: PayoutService,
    private redisService: RedisService,
  ) {}

  // Daily midnight jobs - payouts
  @Cron('0 0 * * *')
  async runDailyPayouts() {
    const lockKey = 'lock:daily-payouts';
    const acquired = await this.redisService.tryLock(lockKey, 1800); // 30 minutes

    if (!acquired) {
      this.logger.log('[CRON] Another instance is already running daily payouts. Skipping.');
      return;
    }

    this.logger.log('[CRON] Running daily payout processing...');
    await this.payoutService.processDailyPayouts();
    this.logger.log('[CRON] Daily payout processing completed.');
  }

  // Daily 2 AM jobs - cleanup
  @Cron('0 2 * * *')
  async runDailyCleanupJobs() {
    const lockKey = 'lock:daily-cleanup';
    const acquired = await this.redisService.tryLock(lockKey, 3600); // 1 hour

    if (!acquired) {
      this.logger.log('[CRON] Another instance is already running daily cleanup. Skipping.');
      return;
    }

    this.logger.log('[CRON] Running daily cleanup jobs...');

    await this.documentCleanup.checkExpiredDocuments();
    await this.sessionCleanup.cleanupExpiredSessions();
    await this.driverCleanup.resetDriverAvailability();
    await this.bookingCleanup.cleanupOldBookings();
    await this.logCleanup.cleanupOldLogs();

    this.logger.log('[CRON] Daily cleanup jobs completed.');
  }

  // Hourly job - mark expired bookings
  @Cron('0 * * * *')
  async runHourlyJobs() {
    const lockKey = 'lock:hourly-booking-expiry';
    const acquired = await this.redisService.tryLock(lockKey, 600); // 10 minutes

    if (!acquired) {
      this.logger.log('[CRON] Another instance is already running hourly jobs. Skipping.');
      return;
    }

    this.logger.log('[CRON] Running hourly cleanup jobs...');

    await this.bookingCleanup.markExpiredBookings();

    this.logger.log('[CRON] Hourly cleanup jobs completed.');
  }
}
