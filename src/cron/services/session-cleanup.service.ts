import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionCleanupService {
  constructor(private prisma: PrismaService) {}

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
}
