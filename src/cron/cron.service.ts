import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, DriverStatus } from '@prisma/client';

@Injectable()
export class CronService {
  constructor(private prisma: PrismaService) {}

  // @Cron('*/5 * * * * *') // Runs every 5 seconds for testing purposes

  // Add this new cron job
  @Cron('0 0 * * *') // Every day at midnight
  async checkExpiredDocuments() {
    const now = new Date();

    // 1. Expire Licenses
    const expiredLicenses = await this.prisma.driverDocuments.updateMany({
      where: {
        licenseExpiry: { lt: now },
        licenseStatus: 'VERIFIED'
      },
      data: { licenseStatus: 'PENDING' }
    });

    // 2. Expire FCs
    const expiredFCs = await this.prisma.driverDocuments.updateMany({
      where: {
        fcExpiry: { lt: now },
        fcStatus: 'VERIFIED'
      },
      data: { fcStatus: 'PENDING' }
    });

    // 3. Expire Insurance
    const expiredInsurances = await this.prisma.driverDocuments.updateMany({
      where: {
        insuranceExpiry: { lt: now },
        insuranceStatus: 'VERIFIED'
      },
      data: { insuranceStatus: 'PENDING' }
    });

    console.log(`Expired docs: License=${expiredLicenses.count}, FC=${expiredFCs.count}, Insurance=${expiredInsurances.count}.`);

    // 4. Update Driver status to PENDING ONLY if they have EXPIRED documents
    const demotedDrivers = await this.prisma.driver.updateMany({
      where: {
        verificationStatus: 'VERIFIED',
        documents: {
          OR: [
            { licenseExpiry: { lt: now } },
            { fcExpiry: { lt: now } },
            { insuranceExpiry: { lt: now } }
          ]
        }
      },
      data: { verificationStatus: 'PENDING' }
    });

    console.log(`Demoted ${demotedDrivers.count} drivers due to expired documents.`);
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

  // Mark expired bookings as expired every 1 hour
  // This is only a fail-safe in case some bookings are not marked expired by the assignment service
  @Cron('0 * * * *')
  async markExpiredBookings() {
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING,
        createdAt: {
          lt: new Date(Date.now() - 10 * 60 * 1000),  // 10 minutes(assignment service uses 5 minutes)
        },
      },
      data: {
        status: BookingStatus.EXPIRED,
      },
    });
    console.log(`Cleaned up ${result.count} expired bookings`);
  }

  //Clean up old expired or completed bookings every day at midnight
  @Cron('0 0 * * *')
  async cleanupExpiredOrCompletedBookings() {
    // Delete expired or completed bookings older than 30 days
    const result = await this.prisma.booking.deleteMany({
      where: {
        status: { in: [BookingStatus.EXPIRED, BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
        createdAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),  // 30 days
        },
      },
    });
    console.log(`Cleaned up ${result.count} expired or completed bookings`);

    // Delete booking addresses that are not associated with any booking (orphaned addresses)
    const bookingAddressResult = await this.prisma.bookingAddress.deleteMany({
      where: {
        pickupBooking: null,
        dropBooking: null,
      },
    });
    console.log(`Cleaned up ${bookingAddressResult.count} orphaned booking addresses`);

    // Delete packages that are not associated with any booking (orphaned packages)
    const packageResult = await this.prisma.package.deleteMany({
      where: {
        booking: null,
      },
    });
    console.log(`Cleaned up ${packageResult.count} orphaned packages`);
  }
}
