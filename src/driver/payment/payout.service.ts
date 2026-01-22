import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RazorpayXService } from 'src/razorpay/razorpayx.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  PaymentMethod,
  TransactionType,
  TransactionCategory,
} from '@prisma/client';
import {
  toDecimal,
  toNumber,
  truncateDecimal,
} from 'src/booking/utils/decimal.utils';
import { FcmEventType } from 'src/common/types/fcm.types';

@Injectable()
export class DriverPayoutService {
  private readonly logger = new Logger(DriverPayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayxService: RazorpayXService,
    private readonly firebaseService: FirebaseService,
  ) {}

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

    this.logger.log(
      `Processing payout for driver ${driver.id}: ₹${payoutAmount}`,
    );

    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const referenceId = `payout-${driver.id}-${todayStr}`;

    // Select payout mode based on driver's registered payout method
    // BANK_ACCOUNT → IMPS (instant bank transfer)
    // VPA → UPI (instant UPI transfer)
    const payoutMode = driver.payoutMethod === 'VPA' ? 'UPI' : 'IMPS';

    // Create payout via RazorpayX (MONEY MOVEMENT FIRST - before DB logging)
    const payout = await this.razorpayxService.createPayout({
      fundAccountId: driver.fundAccountId!,
      amount: payoutAmount,
      currency: 'INR',
      mode: payoutMode,
      purpose: 'payout',
      referenceId,
    });

    // Now log in DB (after money movement initiated)
    await this.prisma.$transaction(async (tx) => {
      // Deduct from driver wallet
      await tx.driver.update({
        where: { id: driver.id },
        data: { walletBalance: 0 },
      });

      // Log payout
      await tx.driverWalletLog.create({
        data: {
          driverId: driver.id,
          beforeBalance: payoutAmount,
          afterBalance: 0,
          amount: -payoutAmount,
          reason: 'Payout to bank account',
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          driverId: driver.id,
          paymentMethod: PaymentMethod.ONLINE,
          amount: payoutAmount,
          type: TransactionType.CREDIT, // Driver receives payout = CREDIT (money IN)
          category: TransactionCategory.DRIVER_PAYOUT,
          description: `Daily payout`,
        },
      });

      // Create payout record
      await tx.payout.create({
        data: {
          driverId: driver.id,
          amount: payoutAmount,
          razorpayPayoutId: payout.razorpayPayoutId,
          status: 'PROCESSING',
          processedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `✓ Processed payout for driver ${driver.id}: ₹${payoutAmount}`,
    );

    // Send notification (fire-and-forget, outside transaction)
    this.notifyDriverPayoutProcessed(driver.id, payoutAmount);
  }

  /**
   * Process withdrawal request from driver
   * Allows driver to withdraw specific amount from wallet
   */
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
        rideCount: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.rideCount < 2) {
      throw new BadRequestException(
        'You must complete at least 2 rides before withdrawing funds',
      );
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
    const serviceFeeDecimal = truncateDecimal(
      withdrawalAmountDecimal.times(0.01),
    );

    // Actual payout amount after service fee
    const payoutAmountDecimal =
      withdrawalAmountDecimal.minus(serviceFeeDecimal);
    const payoutAmount = toNumber(truncateDecimal(payoutAmountDecimal));

    this.logger.log(
      `Processing withdrawal for driver ${driverId}: ₹${withdrawalAmount}`,
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const referenceId = `withdrawal-${driverId}-${timestamp}`;

    // Select payout mode based on driver's registered payout method
    const payoutMode = driver.payoutMethod === 'VPA' ? 'UPI' : 'IMPS';

    // Create payout via RazorpayX (MONEY MOVEMENT FIRST)
    const payout = await this.razorpayxService.createPayout({
      fundAccountId: driver.fundAccountId,
      amount: withdrawalAmount,
      currency: 'INR',
      mode: payoutMode,
      purpose: 'payout',
      referenceId,
    });

    // Now log in DB (after money movement initiated)
    await this.prisma.$transaction(async (tx) => {
      const beforeBalance = toNumber(walletBalanceDecimal);
      const afterBalance = toNumber(
        truncateDecimal(walletBalanceDecimal.minus(withdrawalAmountDecimal)),
      );

      // Deduct from driver wallet
      await tx.driver.update({
        where: { id: driverId },
        data: { walletBalance: afterBalance },
      });

      // Log withdrawal
      await tx.driverWalletLog.create({
        data: {
          driverId,
          beforeBalance,
          afterBalance,
          amount: -withdrawalAmount,
          reason: 'Wallet withdrawal',
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          driverId,
          paymentMethod: PaymentMethod.ONLINE,
          amount: payoutAmount,
          type: TransactionType.CREDIT, // Driver receives withdrawal = CREDIT (money IN)
          category: TransactionCategory.DRIVER_PAYOUT,
          description: 'Wallet withdrawal',
        },
      });

      // Create payout record
      await tx.payout.create({
        data: {
          driverId,
          amount: payoutAmount,
          razorpayPayoutId: payout.razorpayPayoutId,
          status: 'PROCESSING',
          processedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `✓ Processed withdrawal for driver ${driverId}: ₹${withdrawalAmount}`,
    );

    // Send notification
    this.notifyDriverWithdrawalProcessed(driverId, payoutAmount);
  }

  /**
   * Send FCM notification for payout processed
   */
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
