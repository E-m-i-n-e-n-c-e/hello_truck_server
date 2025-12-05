import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentCleanupService } from './services/document-cleanup.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { DriverCleanupService } from './services/driver-cleanup.service';
import { BookingCleanupService } from './services/booking-cleanup.service';
import { LogCleanupService } from './services/log-cleanup.service';

@Module({
  imports: [PrismaModule],
  providers: [
    CronService,
    DocumentCleanupService,
    SessionCleanupService,
    DriverCleanupService,
    BookingCleanupService,
    LogCleanupService,
  ],
})
export class CronModule {}