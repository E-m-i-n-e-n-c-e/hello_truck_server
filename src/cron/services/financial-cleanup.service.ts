import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const FINANCIAL_RETENTION_DAYS = 180;

@Injectable()
export class FinancialCleanupService {
  private readonly logger = new Logger(FinancialCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async cleanupOldFinancialRecords(): Promise<void> {
    const cutoff = new Date(
      Date.now() - FINANCIAL_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    this.logger.log(
      `Cleaning up transactions, payouts, and refund intents older than ${FINANCIAL_RETENTION_DAYS} days...`,
    );

    const deletedTransactions = await this.prisma.transaction.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    const deletedPayouts = await this.prisma.payout.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    const deletedRefundIntents = await this.prisma.refundIntent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(
      `Financial cleanup complete: ${deletedTransactions.count} transactions, ${deletedPayouts.count} payouts, ${deletedRefundIntents.count} refund intents deleted`,
    );
  }
}
