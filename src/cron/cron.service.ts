import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentCleanupService } from './services/document-cleanup.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { DriverCleanupService } from './services/driver-cleanup.service';
import { BookingCleanupService } from './services/booking-cleanup.service';
import { LogCleanupService } from './services/log-cleanup.service';
import { FinancialCleanupService } from './services/financial-cleanup.service';
import { PayoutService } from './services/payout.service';
import { RefundCronService } from './services/refund-cron.service';
import { VerificationRequestService } from './services/verification-request.service';
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
    private financialCleanupService: FinancialCleanupService,
    private payoutService: PayoutService,
    private refundCronService: RefundCronService,
    private verificationRequestService: VerificationRequestService,
    private redisService: RedisService,
  ) {}

  // Daily midnight jobs - payouts
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
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

  // Daily midnight jobs - cleanup
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
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
    await this.financialCleanupService.cleanupOldFinancialRecords();

    this.logger.log('[CRON] Daily cleanup jobs completed.');
  }

  // Every 2 hours - mark expired bookings + process refunds + recover payouts + create verification requests
  @Cron(CronExpression.EVERY_2_HOURS)
  async runHourlyJobs() {
    const lockKey = 'lock:hourly-jobs';
    const acquired = await this.redisService.tryLock(lockKey, 600); // 10 minutes

    if (!acquired) {
      this.logger.log('[CRON] Another instance is already running hourly jobs. Skipping.');
      return;
    }

    this.logger.log('[CRON] Running hourly jobs...');

    await this.bookingCleanup.markExpiredBookings();
    await this.refundCronService.processPendingRefunds();
    await this.payoutService.processRecoverablePayouts();
    await this.verificationRequestService.createMissingVerificationRequests();

    this.logger.log('[CRON] Hourly jobs completed.');
  }
}
