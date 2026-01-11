import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import { TransactionType, TransactionCategory, PaymentMethod } from '@prisma/client';
import { toDecimal, toNumber, truncateDecimal } from 'src/booking/utils/decimal.utils';
import { FcmEventType } from 'src/common/types/fcm.types';

interface CachedPaymentLink {
  paymentLinkId: string;
  shortUrl: string;
  amount: number;
  collected: number;
  expiresAt: number;
}

@Injectable()
export class DriverPaymentService {
  private readonly logger = new Logger(DriverPaymentService.name);
  private readonly LINK_EXPIRY_SECONDS = 1200; // 20 minutes (Razorpay minimum)
  private readonly MIN_REMAINING_SECONDS = 300; // 5 min minimum to reuse link

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly razorpayService: RazorpayService,
    private readonly firebaseService: FirebaseService,
  ) {}

  private getRedisKey(driverId: string): string {
    return `driver:${driverId}:active_plink`;
  }

  /**
   * Generate payment link for driver wallet top-up
   * DB stores referenceId → driverId mapping for webhook lookup
   * Redis caches for spam prevention
   */
  async generatePaymentLink(driverId: string, amount: number): Promise<{
    paymentLinkUrl: string;
    paymentLinkId: string;
    amount: number;
    expiresAt: number;
  }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { phoneNumber: true, firstName: true, lastName: true },
    });

    if (!driver) {
      throw new BadRequestException('Driver not found');
    }

    const redisKey = this.getRedisKey(driverId);
    const now = Math.floor(Date.now() / 1000);

    // Check Redis for existing link
    const cachedStr = await this.redisService.get(redisKey);
    if (cachedStr) {
      const cached: CachedPaymentLink = JSON.parse(cachedStr);
      const remainingTime = cached.expiresAt - now;
      // Reuse if: enough time left, same amount, no partial payment yet
      if (remainingTime >= this.MIN_REMAINING_SECONDS && cached.amount === amount && cached.collected === 0) {
        this.logger.log(`Reusing payment link for driver ${driverId} (${remainingTime}s remaining)`);
        return {
          paymentLinkUrl: cached.shortUrl,
          paymentLinkId: cached.paymentLinkId,
          amount: cached.amount,
          expiresAt: cached.expiresAt,
        };
      }
    }

   // Create DB record first with generated referenceId (UUID, 36 chars)
   const referenceId = crypto.randomUUID();
   await this.prisma.driverPaymentLink.create({
      data: { referenceId, driverId },
    });

    // Create Razorpay link with referenceId
    const expiresAt = now + this.LINK_EXPIRY_SECONDS;
    const customerName = driver.firstName && driver.lastName
      ? `${driver.firstName} ${driver.lastName}`
      : driver.phoneNumber;

    const paymentLink = await this.razorpayService.createPaymentLink({
      amount,
      description: 'Wallet balance settlement',
      customerName,
      customerContact: driver.phoneNumber,
      acceptPartial: true,
      firstMinPartialAmount: 1, // ₹1 minimum
      expireBy: expiresAt,
      referenceId,
      disableNotifications: true, // Don't send email/SMS for driver payments
    });

    // Cache in Redis for spam prevention
    const cacheData: CachedPaymentLink = {
      paymentLinkId: paymentLink.paymentLinkId,
      shortUrl: paymentLink.paymentLinkUrl,
      amount,
      collected: 0,
      expiresAt,
    };
    await this.redisService.set(redisKey, JSON.stringify(cacheData), 'EX', this.LINK_EXPIRY_SECONDS);

    this.logger.log(`Created payment link for driver ${driverId}: ${paymentLink.paymentLinkId}`);

    return {
      paymentLinkUrl: paymentLink.paymentLinkUrl,
      paymentLinkId: paymentLink.paymentLinkId,
      amount,
      expiresAt,
    };
  }

  /**
   * Handle payment from webhook - lookup driver from DB via referenceId
   */
  async handlePaymentReceived(referenceId: string, rzpPaymentId: string, amountPaid: number): Promise<void> {
    const driverId = await this.extractDriverIdFromReference(referenceId);
    if (!driverId) {
      this.logger.warn(`Invalid referenceId`);
      return;
    }

    this.logger.log(`Payment received: driver=${driverId}, amount=${amountPaid}`);

    // Use Decimal for accurate wallet math
    const amountPaidDecimal = truncateDecimal(toDecimal(amountPaid));

    // Credit wallet
    await this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({
        where: { id: driverId },
        select: { walletBalance: true },
      });

      const beforeBalance = toDecimal(driver?.walletBalance ?? 0);
      const afterBalance = truncateDecimal(beforeBalance.plus(amountPaidDecimal));

      await tx.driver.update({
        where: { id: driverId },
        data: { walletBalance: toNumber(afterBalance) },
      });

      await tx.driverWalletLog.create({
        data: {
          driverId,
          beforeBalance: toNumber(beforeBalance),
          afterBalance: toNumber(afterBalance),
          amount: toNumber(amountPaidDecimal),
          reason: `Payment via Razorpay (${rzpPaymentId})`,
        },
      });

      await tx.transaction.create({
        data: {
          driverId,
          paymentMethod: PaymentMethod.ONLINE,
          amount: toNumber(amountPaidDecimal),
          type: TransactionType.CREDIT,
          category: TransactionCategory.DRIVER_PAYMENT,
          description: 'Wallet top-up',
        },
      });
    });

    // Clear cache
    await this.redisService.del(this.getRedisKey(driverId));

    // Send FCM notification to driver
    this.firebaseService.notifyAllSessions(driverId, 'driver', {
      notification: {
        title: 'Payment Successful ✅',
        body: `₹${amountPaid.toFixed(2)} has been credited to your wallet`,
      },
      data: {
        event: FcmEventType.DriverPaymentSuccess,
        amount: amountPaid.toString(),
      },
    });

    this.logger.log(`Credited ₹${amountPaid} to driver ${driverId}`);
  }

  /**
   * Handle link expiry - just clear cache
   */
  async handleLinkExpired(referenceId: string): Promise<void> {
    const driverId = await this.extractDriverIdFromReference(referenceId);
    if (driverId) {
      await this.redisService.del(this.getRedisKey(driverId));
      this.logger.log(`Cleared cache for expired link: driver=${driverId}`);
    }
  }

  /**
   * Lookup driver ID from referenceId via DB
   */
  private async extractDriverIdFromReference(referenceId: string) {
    const paymentLink = await this.prisma.driverPaymentLink.findUnique({
      where: { referenceId },
      select: { driverId: true },
    });

    return paymentLink?.driverId || null;
  }
}
