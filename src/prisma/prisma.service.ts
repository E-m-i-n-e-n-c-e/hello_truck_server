import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();

    const self = this;
    const extended = this.$extends({
      query: {
        driver: {
          async update({ args, query }) {
            const result = await query(args);

            // Only log if driverStatus was updated
            if (args.data?.driverStatus && result.driverStatus && result.id) {
              const driverId = result.id;
              const status = result.driverStatus;
              setImmediate(() => {
                self.driverStatusLog.create({
                  data: { driverId, status }
                }).catch(err => {
                  self.logger.error('Driver status logging failed:', err);
                });
              });
            }

            return result;
          }
        },
        booking: {
          async update({ args, query }) {
            const result = await query(args);

            // Only log if status was updated
            if (args.data?.status && result.status && result.id) {
              const bookingId = result.id;
              const status = result.status;
              setImmediate(() => {
                self.bookingStatusLog.create({
                  data: { bookingId, status }
                }).catch(err => {
                  self.logger.error('Booking status logging failed:', err);
                });
              });
            }

            return result;
          }
        },
      }
    });

    return extended as this;
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