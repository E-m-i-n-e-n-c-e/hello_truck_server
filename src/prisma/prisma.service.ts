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
            // Only intercept if driverStatus is being updated
            if (!args.data?.driverStatus) {
              return query(args);
            }

            // Use Prisma's returning to get both old and new in one query
            const result = await query(args);

            // Create log entry (fire-and-forget)
            setImmediate(() => {
              if (result.driverStatus && result.id) {
                self.driverStatusLog.create({
                  data: { driverId: result.id, status: result.driverStatus }
                }).catch(err => console.error('Driver status logging failed:', err));
              }
            });

            return result;
          }
        },
        booking: {
          async update({ args, query }) {
            // Only intercept if status is being updated
            if (!args.data?.status) {
              return query(args);
            }

            // Use Prisma's returning to get both old and new in one query
            const result = await query(args);

            // Create log entry (fire-and-forget)
            setImmediate(() => {
              if (result.status && result.id) {
                self.bookingStatusLog.create({
                  data: { bookingId: result.id, status: result.status }
                }).catch(err => console.error('Booking status logging failed:', err));
              }
            });

            return result;
          }
        },
      }
    });
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