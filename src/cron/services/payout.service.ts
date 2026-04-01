import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayoutStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DriverPayoutService } from '../../driver/payment/payout.service';
import { EnvironmentVariables } from '../../config/env.config';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly payoutDelayMs: number;
  private readonly stalePayoutMinutes: number;
  private readonly payoutRetryWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverPayoutService: DriverPayoutService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    this.payoutDelayMs = this.configService.get<number>('PAYOUT_DELAY_MS', 200);
    this.stalePayoutMinutes = this.configService.get<number>(
      'PAYOUT_STALE_PROCESSING_MINUTES',
      15,
    );
    this.payoutRetryWindowDays = this.configService.get<number>(
      'PAYOUT_RETRY_WINDOW_DAYS',
      2,
    );
  }

  async processDailyPayouts() {
    this.logger.log('Starting daily payout processing');

    // Get all drivers with positive wallet balance
    const drivers = await this.prisma.driver.findMany({
      where: {
        walletBalance: { gt: 0 },
        fundAccountId: { not: null },
        payoutMethod: { not: null },
      },
    });

    this.logger.log(`Found ${drivers.length} drivers eligible for payout`);

    let successCount = 0;
    let failureCount = 0;

    for (const driver of drivers) {
      try {
        await this.driverPayoutService.processPayout(driver);
        successCount++;
      } catch (error) {
        // Log error but continue to next driver
        this.logger.error(
          `✗ Failed to process payout for driver ${driver.id}: ${error.message}`,
        );
        this.logger.error(error.stack);
        failureCount++;
        // Continue to next driver instead of throwing
      }

      await this.delay(this.payoutDelayMs);
    }

    this.logger.log(
      `Daily payout processing completed: ${successCount} succeeded, ${failureCount} failed`,
    );
  }

  async processRecoverablePayouts(): Promise<void> {
    this.logger.log('Processing recoverable payouts...');

    const staleBefore = new Date(Date.now() - this.stalePayoutMinutes * 60 * 1000);
    const twoDaysAgo = new Date(
      Date.now() - this.payoutRetryWindowDays * 24 * 60 * 60 * 1000,
    );
    const payouts = await this.prisma.payout.findMany({
      where: {
        OR: [
          {
            status: PayoutStatus.FAILED,
            createdAt: { gte: twoDaysAgo },
            razorpayPayoutId: null,
          },
          {
            status: PayoutStatus.PROCESSING,
            processingStartedAt: { lte: staleBefore },
            razorpayPayoutId: null,
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    if (payouts.length === 0) {
      this.logger.log('No recoverable payouts found');
      return;
    }

    this.logger.log(`Found ${payouts.length} recoverable payouts`);

    let recovered = 0;
    let failed = 0;

    for (const payout of payouts) {
      try {
        await this.driverPayoutService.retryPayout(payout.id);
        recovered++;
      } catch (error) {
        this.logger.error(
          `Failed to recover payout ${payout.id}: ${error.message}`,
        );
        failed++;
      }

      await this.delay(this.payoutDelayMs);
    }

    this.logger.log(
      `Recoverable payout processing complete: ${recovered} handled, ${failed} failed`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
