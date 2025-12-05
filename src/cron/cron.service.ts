import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentCleanupService } from './services/document-cleanup.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { DriverCleanupService } from './services/driver-cleanup.service';
import { BookingCleanupService } from './services/booking-cleanup.service';
import { LogCleanupService } from './services/log-cleanup.service';

@Injectable()
export class CronService {
  constructor(
    private documentCleanup: DocumentCleanupService,
    private sessionCleanup: SessionCleanupService,
    private driverCleanup: DriverCleanupService,
    private bookingCleanup: BookingCleanupService,
    private logCleanup: LogCleanupService,
  ) {}

  // Daily midnight jobs
  @Cron('0 0 * * *')
  async runDailyMidnightJobs() {
    console.log('Running daily midnight cleanup jobs...');

    await this.documentCleanup.checkExpiredDocuments();
    await this.sessionCleanup.cleanupExpiredSessions();
    await this.driverCleanup.resetDriverAvailability();
    await this.bookingCleanup.cleanupOldBookings();
    await this.logCleanup.cleanupOldLogs();

    console.log('Daily midnight cleanup jobs completed.');
  }

  // Hourly job - mark expired bookings
  @Cron('0 * * * *')
  async runHourlyJobs() {
    console.log('Running hourly cleanup jobs...');

    await this.bookingCleanup.markExpiredBookings();

    console.log('Hourly cleanup jobs completed.');
  }
}
