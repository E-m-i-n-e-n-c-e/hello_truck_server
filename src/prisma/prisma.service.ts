import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, BookingStatus, DriverStatus } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();

    const self = this;
    this.$extends({
      query: {
        driver: {
          async update({ args, query }) {
            const result = await query(args);

            // After update succeeds, handle logging non-blocking
            setImmediate(() => {
              if(result.driverStatus && result.id) {
              self.handleDriverStatusChange(result.id, result.driverStatus).catch(err => {
                  console.error('Driver status logging failed:', err);
                });
              }
            });

            return result;
          }
        },
        booking: {
          async update({ args, query }) {
            const result = await query(args);

            // After update succeeds, handle logging non-blocking
            setImmediate(() => {
              if (result.status && result.id) {
                self.handleBookingStatusChange(result.id!, result.status!).catch(err => {
                  console.error('Booking lifecycle logging failed:', err);
                });
              }
            });

            return result;
          }
        },
      }
    });
  }

  // Public method to create lifecycle event when status changes
  async handleBookingStatusChange(bookingId: string, newStatus: BookingStatus) {
    const oldStatus = await this.booking.findUnique({
      where: { id: bookingId },
      select: { status: true }
    });

    if (oldStatus && oldStatus.status !== newStatus) {
      await this.bookingStatusLog.create({
        data: {
          bookingId,
          status: newStatus,
        }
      });
    }
  }

  // Public method to create driver status log when status changes
  async handleDriverStatusChange(driverId: string, newStatus: DriverStatus) {
    const oldStatus = await this.driver.findUnique({
      where: { id: driverId },
      select: { driverStatus: true }
    });
    if (oldStatus && oldStatus.driverStatus !== newStatus) {
      await this.driverStatusLog.create({
        data: { driverId, status: newStatus }
      });
    }
  }


  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// This service now handles automatic logging non-blocking:
// 1. Status logs when booking status changes (fire-and-forget)
// 2. Driver status logs when driver status changes (fire-and-forget)
//
// User gets immediate response, logging happens in background.
// Manual driver status updates and other business logic
// should be handled in the service layer.