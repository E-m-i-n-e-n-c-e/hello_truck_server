import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogCleanupService {
  constructor(private prisma: PrismaService) {}

  async cleanupOldLogs() {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);  // 30 days

    // Delete driver status logs older than 1 month
    const driverStatusLogsResult = await this.prisma.driverStatusLog.deleteMany({
      where: {
        statusChangedAt: {
          lt: oneMonthAgo,
        },
      },
    });
    console.log(`Cleaned up ${driverStatusLogsResult.count} driver status logs older than 1 month`);

    // Delete webhook logs older than 1 month
    const webhookLogsResult = await this.prisma.webhookLog.deleteMany({
      where: {
        createdAt: {
          lt: oneMonthAgo,
        },
      },
    });
    console.log(`Cleaned up ${webhookLogsResult.count} webhook logs older than 1 month`);
  }
}
