import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentMethod,
  Payout,
  PayoutStatus,
  TransactionCategory,
  TransactionType,
} from '@prisma/client';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  toDecimal,
  toNumber,
  truncateDecimal,
} from 'src/booking/utils/decimal.utils';
import { FcmEventType } from 'src/common/types/fcm.types';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayXService } from 'src/razorpay/razorpayx.service';
import { PayoutResponse } from 'src/razorpay/types/razorpayx-payout.types';
import { EnvironmentVariables } from 'src/config/env.config';

const RATE_LIMIT_DELAY_MS = 1000;

@Injectable()
export class DriverPayoutService {
  private readonly logger = new Logger(DriverPayoutService.name);
  private readonly stalePayoutMinutes: number;
  private readonly payoutRetryWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayxService: RazorpayXService,
    private readonly firebaseService: FirebaseService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    this.stalePayoutMinutes = this.configService.get<number>(
      'PAYOUT_STALE_PROCESSING_MINUTES',
      15,
    );
    this.payoutRetryWindowDays = this.configService.get<number>(
      'PAYOUT_RETRY_WINDOW_DAYS',
      2,
    );
  }

  /**
   * Process payout for a single driver
   * Called by PayoutService cron job
   */
  async processPayout(driver: {
    id: string;
    walletBalance: any;
    fundAccountId: string | null;
    payoutMethod: string | null;
  }): Promise<void> {
    const walletBalanceDecimal = toDecimal(driver.walletBalance);
    const payoutAmount = toNumber(truncateDecimal(walletBalanceDecimal));

    if (payoutAmount <= 0) {
      return;
    }

    if (!driver.fundAccountId || !driver.payoutMethod) {
      throw new BadRequestException(
        'Payout method not configured. Please add bank account or UPI details.',
      );
    }

    this.logger.log(`Processing payout for driver ${driver.id}: Rs.${payoutAmount}`);

    const payoutRecord = await this.prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driver.id },
        data: { walletBalance: 0 },
      });

      await tx.driverWalletLog.create({
        data: {
          driverId: driver.id,
          beforeBalance: payoutAmount,
          afterBalance: 0,
          amount: -payoutAmount,
          reason: 'Payout to bank account',
        },
      });

      const payout = await tx.payout.create({
        data: {
          driverId: driver.id,
          amount: payoutAmount,
          status: PayoutStatus.PROCESSING,
          processingStartedAt: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          driverId: driver.id,
          paymentMethod: PaymentMethod.ONLINE,
          amount: payoutAmount,
          type: TransactionType.CREDIT,
          category: TransactionCategory.DRIVER_PAYOUT,
          description: 'Daily payout',
          payoutId: payout.id,
        },
      });

      return payout;
    });

    await this.executeStoredPayout(
      payoutRecord.id,
      driver.id,
      driver.fundAccountId,
      driver.payoutMethod,
      payoutAmount,
    );
  }

  async retryPayout(payoutId: string): Promise<void> {
    const staleBefore = new Date(Date.now() - this.stalePayoutMinutes * 60 * 1000);
    const retryWindowStart = new Date(
      Date.now() - this.payoutRetryWindowDays * 24 * 60 * 60 * 1000,
    );

    const [payout] = await this.prisma.payout.updateManyAndReturn({
      where: {
        id: payoutId,
        razorpayPayoutId: null,
        OR: [
          {
            status: PayoutStatus.FAILED,
            createdAt: { gte: retryWindowStart },
          },
          {
            status: PayoutStatus.PROCESSING,
            processingStartedAt: { lte: staleBefore },
          },
        ],
      },
      data: {
        status: PayoutStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
      include: {
        driver: {
          select: {
            id: true,
            fundAccountId: true,
            payoutMethod: true,
          },
        },
      },
    });

    if (!payout) {
      return;
    }

    await this.executeStoredPayout(
      payout.id,
      payout.driver.id,
      payout.driver.fundAccountId,
      payout.driver.payoutMethod,
      toNumber(truncateDecimal(payout.amount)),
    );
  }

  async processWithdrawal(driverId: string, amount: number): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be positive');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        walletBalance: true,
        fundAccountId: true,
        payoutMethod: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (!driver.fundAccountId || !driver.payoutMethod) {
      throw new BadRequestException(
        'Payout method not configured. Please add bank account or UPI details.',
      );
    }

    const walletBalanceDecimal = toDecimal(driver.walletBalance);
    const withdrawalAmountDecimal = toDecimal(amount);

    if (walletBalanceDecimal.lessThan(withdrawalAmountDecimal)) {
      throw new Error('Insufficient wallet balance');
    }

    const withdrawalAmount = toNumber(truncateDecimal(withdrawalAmountDecimal));

    // Calculate 1% service fee (truncated to 2 decimal places)
    const serviceFeeDecimal = truncateDecimal(withdrawalAmountDecimal.times(0.01));
    
    // Actual payout amount after service fee
    const payoutAmountDecimal = withdrawalAmountDecimal.minus(serviceFeeDecimal);
    const payoutAmount = toNumber(truncateDecimal(payoutAmountDecimal));

    this.logger.log(
      `Processing withdrawal for driver ${driverId}: ₹${withdrawalAmount}`,
    );

    const payoutRecord = await this.prisma.$transaction(async (tx) => {
      const beforeBalance = toNumber(walletBalanceDecimal);
      const afterBalance = toNumber(
        truncateDecimal(walletBalanceDecimal.minus(withdrawalAmountDecimal)),
      );

      await tx.driver.update({
        where: { id: driverId },
        data: { walletBalance: afterBalance },
      });

      await tx.driverWalletLog.create({
        data: {
          driverId,
          beforeBalance,
          afterBalance,
          amount: -withdrawalAmount,
          reason: 'Wallet withdrawal',
        },
      });

      const payout = await tx.payout.create({
        data: {
          driverId,
          amount: payoutAmount,
          status: PayoutStatus.PROCESSING,
          processingStartedAt: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          driverId,
          paymentMethod: PaymentMethod.ONLINE,
          amount: payoutAmount,
          type: TransactionType.CREDIT,
          category: TransactionCategory.DRIVER_PAYOUT,
          description: 'Wallet withdrawal',
          payoutId: payout.id,
        },
      });

      return payout;
    });

    await this.executeStoredPayout(
      payoutRecord.id,
      driverId,
      driver.fundAccountId,
      driver.payoutMethod,
      payoutAmount,
      'Wallet withdrawal',
    );
  }

  private async executeStoredPayout(
    payoutId: string,
    driverId: string,
    fundAccountId: string | null,
    payoutMethod: string | null,
    payoutAmount: number,
    successDescription: 'Daily payout' | 'Wallet withdrawal' = 'Daily payout',
  ): Promise<void> {
    if (!fundAccountId || !payoutMethod) {
      await this.markPayoutFailed(
        payoutId,
        'Payout method not configured. Please add bank account or UPI details.',
      );
      throw new BadRequestException(
        'Payout method not configured. Please add bank account or UPI details.',
      );
    }

    const payoutMode = payoutMethod === 'VPA' ? 'UPI' : 'IMPS';
    const referenceId = payoutId;

    try {
      let payout: PayoutResponse;

      try {
        payout = await this.razorpayxService.createPayout({
          fundAccountId,
          amount: payoutAmount,
          currency: 'INR',
          mode: payoutMode,
          purpose: 'payout',
          referenceId,
        });
      } catch (error) {
        if (!this.isRateLimitError(error)) {
          throw error;
        }

        await this.delay(RATE_LIMIT_DELAY_MS);
        payout = await this.razorpayxService.createPayout({
          fundAccountId,
          amount: payoutAmount,
          currency: 'INR',
          mode: payoutMode,
          purpose: 'payout',
          referenceId,
        });
      }

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          razorpayPayoutId: payout.razorpayPayoutId,
          status: PayoutStatus.COMPLETED,
          failureReason: null,
          processedAt: new Date(),
        },
      });

      this.logger.log(`${successDescription} processed for driver ${driverId}: Rs.${payoutAmount}`);

      if (successDescription === 'Wallet withdrawal') {
        this.notifyDriverWithdrawalProcessed(driverId, payoutAmount);
      } else {
        this.notifyDriverPayoutProcessed(driverId, payoutAmount);
      }
    } catch (error) {
      await this.markPayoutFailed(payoutId, error.message);
      throw error;
    }
  }

  private async markPayoutFailed(
    payoutId: string,
    failureReason: string,
  ): Promise<void> {
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.FAILED,
        failureReason,
        retryCount: {
          increment: 1,
        },
      },
    });
  }

  private isRateLimitError(error: any): boolean {
    const status = error?.response?.status ?? error?.status;
    const message = String(error?.message ?? '').toLowerCase();
    return status === 429 || message.includes('429') || message.includes('rate limit');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private notifyDriverPayoutProcessed(driverId: string, amount: number): void {
    this.firebaseService
      .notifyAllSessions(driverId, 'driver', {
        notification: {
          title: 'Payout Processed 💰',
          body: `₹${amount.toFixed(2)} has been transferred to your account`,
        },
        data: {
          event: FcmEventType.DriverPayoutProcessed,
          amount: amount.toString(),
        },
      })
      .catch((error) => {
        this.logger.error(
          `Failed to send payout notification to driver ${driverId}: ${error.message}`,
        );
      });
  }

  /**
   * Send FCM notification for withdrawal processed
   */
  private notifyDriverWithdrawalProcessed(
    driverId: string,
    amount: number,
  ): void {
    this.firebaseService
      .notifyAllSessions(driverId, 'driver', {
        notification: {
          title: 'Withdrawal Successful ✅',
          body: `₹${amount.toFixed(2)} has been transferred to your account`,
        },
        data: {
          event: FcmEventType.DriverWithdrawalProcessed,
          amount: amount.toString(),
        },
      })
      .catch((error) => {
        this.logger.error(
          `Failed to send withdrawal notification to driver ${driverId}: ${error.message}`,
        );
      });
  }
}
