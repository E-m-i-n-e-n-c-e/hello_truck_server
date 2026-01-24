import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DriverPayoutService } from '../../driver/payment/payout.service';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverPayoutService: DriverPayoutService,
  ) {}

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
    }

    this.logger.log(
      `Daily payout processing completed: ${successCount} succeeded, ${failureCount} failed`,
    );
  }
}
