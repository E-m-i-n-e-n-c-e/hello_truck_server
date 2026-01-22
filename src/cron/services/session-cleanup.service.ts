import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);
  constructor(private prisma: PrismaService) {}

  async cleanupExpiredSessions() {
    const customerResult = await this.prisma.customerSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    this.logger.log(
      `Cleaned up ${customerResult.count} expired customer sessions`,
    );

    const driverResult = await this.prisma.driverSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    this.logger.log(`Cleaned up ${driverResult.count} expired driver sessions`);
  }
}
