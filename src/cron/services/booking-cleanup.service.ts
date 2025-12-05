import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingCleanupService {
  constructor(private prisma: PrismaService) {}

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

  async cleanupOldBookings() {
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
