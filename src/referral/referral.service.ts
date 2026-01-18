import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateReferralCode } from '../common/utils/referral-code.util';
import { FirebaseService } from '../firebase/firebase.service';
import { FcmEventType } from '../common/types/fcm.types';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly MAX_REFERRALS = 5;
  private readonly MAX_RETRIES = 5;

  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
  ) {}

  /**
   * Generate and assign a referral code to a customer (called asynchronously after signup)
   */
  async generateCustomerReferralCode(customerId: string): Promise<string> {
    this.logger.log(`Generating referral code for customer ${customerId}`);

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const code = generateReferralCode('CUS');

        const customer = await this.prisma.customer.update({
          where: { id: customerId },
          data: { referralCode: code },
        });

        this.logger.log(
          `Successfully generated referral code ${code} for customer ${customerId}`,
        );
        return customer.referralCode!;
      } catch (error) {
        if (error.code === 'P2002') {
          this.logger.warn(
            `Customer referral code collision on attempt ${attempt + 1}, retrying...`,
          );
          continue;
        }
        this.logger.error(
          `Failed to generate customer referral code: ${error.message}`,
        );
        throw error;
      }
    }

    throw new Error(
      `Failed to generate unique customer referral code after ${this.MAX_RETRIES} attempts`,
    );
  }

  /**
   * Generate and assign a referral code to a driver (called asynchronously after signup)
   */
  async generateDriverReferralCode(driverId: string): Promise<string> {
    this.logger.log(`Generating referral code for driver ${driverId}`);

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const code = generateReferralCode('DRI');

        const driver = await this.prisma.driver.update({
          where: { id: driverId },
          data: { referralCode: code },
        });

        this.logger.log(
          `Successfully generated referral code ${code} for driver ${driverId}`,
        );
        return driver.referralCode!;
      } catch (error) {
        if (error.code === 'P2002') {
          this.logger.warn(
            `Driver referral code collision on attempt ${attempt + 1}, retrying...`,
          );
          continue;
        }
        this.logger.error(
          `Failed to generate driver referral code: ${error.message}`,
        );
        throw error;
      }
    }

    throw new Error(
      `Failed to generate unique driver referral code after ${this.MAX_RETRIES} attempts`,
    );
  }

  /**
   * Apply a referral code when a customer signs up
   */
  async applyCustomerReferralCode(
    referralCode: string,
    newCustomerId: string,
  ): Promise<void> {
    this.logger.log(
      `Applying referral code ${referralCode} for customer ${newCustomerId}`,
    );

    await this.prisma.$transaction(async (tx) => {
      // Find the referrer by code
      const referrer = await tx.customer.findUnique({
        where: { referralCode },
      });

      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }

      if (referrer.id === newCustomerId) {
        throw new BadRequestException('Cannot use your own referral code');
      }

      // Check if new customer already used a referral code
      const existingReferral = await tx.customerReferral.findUnique({
        where: { referredId: newCustomerId },
      });

      if (existingReferral) {
        throw new BadRequestException('Referral code already applied');
      }

      // Check referrer's referral count
      const referralCount = await tx.customerReferral.count({
        where: { referrerId: referrer.id },
      });

      if (referralCount >= this.MAX_REFERRALS) {
        throw new BadRequestException('Referral limit reached for this code');
      }

      // Create the referral record
      await tx.customerReferral.create({
        data: {
          referrerId: referrer.id,
          referredId: newCustomerId,
        },
      });

      // 1. Credit Referrer (Customer) -> 100
      const updatedReferrer = await tx.customer.update({
        where: { id: referrer.id },
        data: { walletBalance: { increment: 100 } },
      });

      await tx.customerWalletLog.create({
        data: {
          customerId: referrer.id,
          amount: 100,
          reason: 'Referral Bonus',
          beforeBalance: referrer.walletBalance!, // Assuming fetched by findUnique
          afterBalance: updatedReferrer.walletBalance!,
        },
      });

      // 2. Credit Referred (New Customer) -> 50
      const newCustomer = await tx.customer.findUnique({
        where: { id: newCustomerId },
      });

      if (newCustomer) {
        const updatedNewCustomer = await tx.customer.update({
          where: { id: newCustomerId },
          data: { walletBalance: { increment: 50 } },
        });

        await tx.customerWalletLog.create({
          data: {
            customerId: newCustomerId,
            amount: 50,
            reason: 'Referral Bonus',
            beforeBalance: newCustomer.walletBalance!,
            afterBalance: updatedNewCustomer.walletBalance!,
          },
        });
      }

      this.logger.log(
        `Successfully applied referral code ${referralCode} for customer ${newCustomerId}`,
      );

      // Send notifications (fire-and-forget)
      this.firebaseService.notifyAllSessions(referrer.id, 'customer', {
        data: { event: FcmEventType.WalletChange },
      });
      this.firebaseService.notifyAllSessions(newCustomerId, 'customer', {
        data: { event: FcmEventType.WalletChange },
      });
    });
  }

  /**
   * Apply a referral code when a driver signs up
   */
  async applyDriverReferralCode(
    referralCode: string,
    newDriverId: string,
  ): Promise<void> {
    this.logger.log(
      `Applying referral code ${referralCode} for driver ${newDriverId}`,
    );

    await this.prisma.$transaction(async (tx) => {
      // Find the referrer by code
      const referrer = await tx.driver.findUnique({
        where: { referralCode },
      });

      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }

      if (referrer.id === newDriverId) {
        throw new BadRequestException('Cannot use your own referral code');
      }

      // Check if new driver already used a referral code
      const existingReferral = await tx.driverReferral.findUnique({
        where: { referredId: newDriverId },
      });

      if (existingReferral) {
        throw new BadRequestException('Referral code already applied');
      }

      // Check referrer's referral count
      const referralCount = await tx.driverReferral.count({
        where: { referrerId: referrer.id },
      });

      if (referralCount >= this.MAX_REFERRALS) {
        throw new BadRequestException('Referral limit reached for this code');
      }

      // Create the referral record
      await tx.driverReferral.create({
        data: {
          referrerId: referrer.id,
          referredId: newDriverId,
        },
      });

      // 1. Credit Referrer (Driver) -> 300
      const updatedReferrer = await tx.driver.update({
        where: { id: referrer.id },
        data: { walletBalance: { increment: 300 } },
      });

      await tx.driverWalletLog.create({
        data: {
          driverId: referrer.id,
          amount: 300,
          reason: 'Referral Bonus',
          beforeBalance: referrer.walletBalance!,
          afterBalance: updatedReferrer.walletBalance!,
        },
      });

      // 2. Credit Referred (New Driver) -> 50
      const newDriver = await tx.driver.findUnique({
        where: { id: newDriverId },
      });

      if (newDriver) {
        const updatedNewDriver = await tx.driver.update({
          where: { id: newDriverId },
          data: { walletBalance: { increment: 50 } },
        });

        await tx.driverWalletLog.create({
          data: {
            driverId: newDriverId,
            amount: 50,
            reason: 'Referral Bonus',
            beforeBalance: newDriver.walletBalance!,
            afterBalance: updatedNewDriver.walletBalance!,
          },
        });
      }

      this.logger.log(
        `Successfully applied referral code ${referralCode} for driver ${newDriverId}`,
      );

      // Send notifications (fire-and-forget)
      this.firebaseService.notifyAllSessions(referrer.id, 'driver', {
        data: { event: FcmEventType.WalletChange },
      });
      this.firebaseService.notifyAllSessions(newDriverId, 'driver', {
        data: { event: FcmEventType.WalletChange },
      });
    });
  }

  /**
   * Get referral stats for a customer
   */
  async getCustomerReferralStats(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { referralCode: true },
    });

    const [referralCount, referrals] = await Promise.all([
      this.prisma.customerReferral.count({
        where: { referrerId: customerId },
      }),
      this.prisma.customerReferral.findMany({
        where: { referrerId: customerId },
        include: {
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      referralCode: customer?.referralCode,
      totalReferrals: referralCount,
      remainingReferrals: Math.max(0, this.MAX_REFERRALS - referralCount),
      maxReferrals: this.MAX_REFERRALS,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredCustomer: r.referred,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Get referral stats for a driver
   */
  async getDriverReferralStats(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { referralCode: true },
    });

    const [referralCount, referrals] = await Promise.all([
      this.prisma.driverReferral.count({
        where: { referrerId: driverId },
      }),
      this.prisma.driverReferral.findMany({
        where: { referrerId: driverId },
        include: {
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      referralCode: driver?.referralCode,
      totalReferrals: referralCount,
      remainingReferrals: Math.max(0, this.MAX_REFERRALS - referralCount),
      maxReferrals: this.MAX_REFERRALS,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredDriver: r.referred,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Validate a customer referral code
   */
  async validateCustomerReferralCode(
    referralCode: string,
    customerId: string,
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Find the referrer by code
      const referrer = await this.prisma.customer.findUnique({
        where: { referralCode },
      });

      if (!referrer) {
        return { isValid: false, reason: 'Invalid referral code' };
      }

      if (referrer.id === customerId) {
        return { isValid: false, reason: 'Cannot use your own referral code' };
      }

      // Check if customer already used a referral code
      const existingReferral = await this.prisma.customerReferral.findUnique({
        where: { referredId: customerId },
      });

      if (existingReferral) {
        return { isValid: false, reason: 'Referral code already applied' };
      }

      // Check referrer's referral count
      const referralCount = await this.prisma.customerReferral.count({
        where: { referrerId: referrer.id },
      });

      if (referralCount >= this.MAX_REFERRALS) {
        return { isValid: false, reason: 'Referral limit reached for this code' };
      }

      return { isValid: true };
    } catch (error) {
      this.logger.error(`Error validating customer referral code: ${error.message}`);
      return { isValid: false, reason: 'Validation error' };
    }
  }

  /**
   * Validate a driver referral code
   */
  async validateDriverReferralCode(
    referralCode: string,
    driverId: string,
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Find the referrer by code
      const referrer = await this.prisma.driver.findUnique({
        where: { referralCode },
      });

      if (!referrer) {
        return { isValid: false, reason: 'Invalid referral code' };
      }

      if (referrer.id === driverId) {
        return { isValid: false, reason: 'Cannot use your own referral code' };
      }

      // Check if driver already used a referral code
      const existingReferral = await this.prisma.driverReferral.findUnique({
        where: { referredId: driverId },
      });

      if (existingReferral) {
        return { isValid: false, reason: 'Referral code already applied' };
      }

      // Check referrer's referral count
      const referralCount = await this.prisma.driverReferral.count({
        where: { referrerId: referrer.id },
      });

      if (referralCount >= this.MAX_REFERRALS) {
        return { isValid: false, reason: 'Referral limit reached for this code' };
      }

      return { isValid: true };
    } catch (error) {
      this.logger.error(`Error validating driver referral code: ${error.message}`);
      return { isValid: false, reason: 'Validation error' };
    }
  }
}
