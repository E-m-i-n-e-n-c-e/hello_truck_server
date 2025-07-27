import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CronService {
  constructor(private prisma: PrismaService) {}

  // @Cron('*/5 * * * * *') // Runs every 5 seconds for testing purposes

  // Cleanup expired OTPs every 2 minutes
  @Cron('*/2 * * * *')
  async cleanupExpiredOtps() {
    const result = await this.prisma.otpVerification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`Cleaned up ${result.count} expired OTPs`);
  }

  // Cleanup expired sessions every day at midnight
  @Cron('0 0 * * *')
  async cleanupExpiredSessions() {
    const result = await this.prisma.customerSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    console.log(`Cleaned up ${result.count} expired sessions`);
  }
}
