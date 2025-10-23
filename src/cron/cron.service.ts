import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, DriverStatus } from '@prisma/client';

@Injectable()
export class CronService {
  constructor(private prisma: PrismaService) {}

  // @Cron('*/5 * * * * *') // Runs every 5 seconds for testing purposes

  // Mark expired bookings as expired every 10 minutes
  @Cron('*/2 * * * *')
  async cleanupExpiredBookings() {
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING,
        createdAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000),  // 10 minutes
        },
      },
      data: {
        status: BookingStatus.EXPIRED,
      },
    });
    console.log(`Cleaned up ${result.count} expired bookings`);
  }

  // Cleanup expired sessions every day at midnight
  @Cron('0 0 * * *')
  async cleanupExpiredSessions() {
    const customerResult = await this.prisma.customerSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`Cleaned up ${customerResult.count} expired customer sessions`);

    const driverResult = await this.prisma.driverSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`Cleaned up ${driverResult.count} expired driver sessions`);
  }

  // Reset all drivers to unavailable every day at midnight
  @Cron('0 0 * * *')
  async resetDriverAvailability() {
    const result = await this.prisma.driver.updateMany({
      where: {
        driverStatus: DriverStatus.AVAILABLE,
      },
      data: {
        driverStatus: DriverStatus.UNAVAILABLE
      }
    });
    console.log(`Reset ${result.count} drivers to UNAVAILABLE at midnight`);
  }
}
