import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogCleanupService {
  constructor(private prisma: PrismaService) {}

  async cleanupOldLogs() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);  // 30 days

    // Delete driver status logs older than 30 days
    const driverStatusLogsResult = await this.prisma.driverStatusLog.deleteMany({
      where: { statusChangedAt: { lt: thirtyDaysAgo } },
    });
    console.log(`Cleaned up ${driverStatusLogsResult.count} driver status logs`);

    // Delete webhook logs older than 30 days
    const webhookLogsResult = await this.prisma.webhookLog.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    console.log(`Cleaned up ${webhookLogsResult.count} webhook logs`);
    
    // Delete driver wallet logs older than 30 days
    const driverWalletLogsResult = await this.prisma.driverWalletLog.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    console.log(`Cleaned up ${driverWalletLogsResult.count} driver wallet logs`);
    
    // Delete customer wallet logs older than 30 days
    const customerWalletLogsResult = await this.prisma.customerWalletLog.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    console.log(`Cleaned up ${customerWalletLogsResult.count} customer wallet logs`);
  }
}
