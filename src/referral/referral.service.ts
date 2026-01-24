import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateReferralCode } from '../common/utils/referral-code.util';
import { FirebaseService } from '../firebase/firebase.service';
import { FcmEventType } from '../common/types/fcm.types';
import { CustomerReferralStatsDto, DriverReferralStatsDto } from './dtos/referral-stats.dto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly MAX_RETRIES = 5;
  private readonly WINDOW_HOURS = 24;

  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
  ) {}

  /**
   * Check if user is within the eligibility window to apply referral codes
   * @param timestamp - Timestamp when profile was created (profileCreatedAt or createdAt)
   * @param windowHours - Eligibility window in hours (default: 24)
   * @returns true if within the eligibility window
   */
  private isWithinReferralWindow(
    timestamp: Date,
    windowHours: number = this.WINDOW_HOURS,
  ): boolean {
    const now = new Date();
    const windowMs = windowHours * 60 * 60 * 1000;
    const timeSinceProfileCreation = now.getTime() - timestamp.getTime();

    return timeSinceProfileCreation <= windowMs;
  }

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
   * Now only credits ₹50 to the referred customer instantly
   * Referrer gets ₹100 later when referred completes first booking
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

      // Create the referral record (referrerRewardApplied = false by default)
      await tx.customerReferral.create({
        data: {
          referrerId: referrer.id,
          referredId: newCustomerId,
          referredRewardApplied: true, // Mark referred reward as applied
        },
      });

      // Check if 1 day has passed since profile creation before crediting reward
      const newCustomer = await tx.customer.findUnique({
        where: { id: newCustomerId },
        select: {
          walletBalance: true,
          profileCreatedAt: true,
          createdAt: true,
        },
      });

      if (newCustomer) {
        // Use profileCreatedAt if available, otherwise fallback to createdAt
        const profileTimestamp = newCustomer.profileCreatedAt ?? newCustomer.createdAt;

        // Check if within referral eligibility window (first 24 hours)
        if (!this.isWithinReferralWindow(profileTimestamp)) {
          throw new BadRequestException(
            'Referral codes can only be applied within 24 hours of signup',
          );
        }

        const updatedNewCustomer = await tx.customer.update({
          where: { id: newCustomerId },
          data: { walletBalance: { increment: 50 } },
        });

        await tx.customerWalletLog.create({
          data: {
            customerId: newCustomerId,
            amount: 50,
            reason: 'Referral Signup Bonus',
            beforeBalance: newCustomer.walletBalance!,
            afterBalance: updatedNewCustomer.walletBalance!,
          },
        });

        this.logger.log(
          `Successfully applied referral code ${referralCode} for customer ${newCustomerId}. Credited ₹50 to referred customer.`,
        );

        // Send notification to referred customer only
        this.firebaseService.notifyAllSessions(newCustomerId, 'customer', {
          data: { event: FcmEventType.WalletChange },
        });
      }
    });
  }

  /**
   * Apply referrer reward when referred customer completes their first booking
   * Called asynchronously after first booking completion
   * Idempotent - safe to call multiple times
   */
  async applyCustomerReferrerReward(referredCustomerId: string): Promise<void> {
    this.logger.log(
      `Applying referrer reward for referred customer ${referredCustomerId}`,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        // Find the referral record (idempotent update)
        const referralUpdate = await tx.customerReferral.updateMany({
          where: {
            referredId: referredCustomerId,
            referrerRewardApplied: false,
          },
          data: {
            referrerRewardApplied: true,
          },
        });

        // If no rows updated, reward already applied or no referral exists
        if (referralUpdate.count === 0) {
          this.logger.log(
            `No referrer reward to apply for customer ${referredCustomerId} (already applied or no referral)`,
          );
          return;
        }

        // Get the referral record to find referrer
        const referral = await tx.customerReferral.findUnique({
          where: { referredId: referredCustomerId },
          include: { referrer: true },
        });

        if (!referral) {
          this.logger.warn(
            `Referral record not found after update for customer ${referredCustomerId}`,
          );
          return;
        }

        const referrer = referral.referrer;

        // Credit referrer ₹100
        const updatedReferrer = await tx.customer.update({
          where: { id: referrer.id },
          data: { walletBalance: { increment: 100 } },
        });

        await tx.customerWalletLog.create({
          data: {
            customerId: referrer.id,
            amount: 100,
            reason: 'Referral Completion Bonus',
            beforeBalance: referrer.walletBalance!,
            afterBalance: updatedReferrer.walletBalance!,
          },
        });

        this.logger.log(
          `Successfully applied ₹100 referrer reward to customer ${referrer.id}`,
        );

        // Send notification to referrer
        this.firebaseService.notifyAllSessions(referrer.id, 'customer', {
          data: { event: FcmEventType.WalletChange },
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to apply customer referrer reward: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Apply a referral code when a driver signs up
   * Now only credits ₹50 to the referred driver instantly
   * Referrer gets ₹300 later when referred completes first ride
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

      // Create the referral record (referrerRewardApplied = false by default)
      await tx.driverReferral.create({
        data: {
          referrerId: referrer.id,
          referredId: newDriverId,
          referredRewardApplied: true, // Mark referred reward as applied
        },
      });

      // Check if 1 day has passed since profile creation before crediting reward
      const newDriver = await tx.driver.findUnique({
        where: { id: newDriverId },
        select: {
          walletBalance: true,
          profileCreatedAt: true,
          createdAt: true,
        },
      });

      if (newDriver) {
        // Use profileCreatedAt if available, otherwise fallback to createdAt
        const profileTimestamp = newDriver.profileCreatedAt || newDriver.createdAt;

        // Check if within referral eligibility window (first 24 hours)
        if (!this.isWithinReferralWindow(profileTimestamp)) {
          throw new BadRequestException(
            'Referral codes can only be applied within 24 hours of signup',
          );
        }

        const updatedNewDriver = await tx.driver.update({
          where: { id: newDriverId },
          data: { walletBalance: { increment: 50 } },
        });

        await tx.driverWalletLog.create({
          data: {
            driverId: newDriverId,
            amount: 50,
            reason: 'Referral Signup Bonus',
            beforeBalance: newDriver.walletBalance!,
            afterBalance: updatedNewDriver.walletBalance!,
          },
        });

        this.logger.log(
          `Successfully applied referral code ${referralCode} for driver ${newDriverId}. Credited ₹50 to referred driver.`,
        );

        // Send notification to referred driver only
        this.firebaseService.notifyAllSessions(newDriverId, 'driver', {
          data: { event: FcmEventType.WalletChange },
        });
      }
    });
  }

  /**
   * Apply referrer reward when referred driver completes their first ride
   * Called asynchronously after first ride completion
   * Idempotent - safe to call multiple times
   */
  async applyDriverReferrerReward(referredDriverId: string): Promise<void> {
    this.logger.log(
      `Applying referrer reward for referred driver ${referredDriverId}`,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        // Find the referral record (idempotent update)
        const referralUpdate = await tx.driverReferral.updateMany({
          where: {
            referredId: referredDriverId,
            referrerRewardApplied: false,
          },
          data: {
            referrerRewardApplied: true,
          },
        });

        // If no rows updated, reward already applied or no referral exists
        if (referralUpdate.count === 0) {
          this.logger.log(
            `No referrer reward to apply for driver ${referredDriverId} (already applied or no referral)`,
          );
          return;
        }

        // Get the referral record to find referrer
        const referral = await tx.driverReferral.findUnique({
          where: { referredId: referredDriverId },
          include: { referrer: true },
        });

        if (!referral) {
          this.logger.warn(
            `Referral record not found after update for driver ${referredDriverId}`,
          );
          return;
        }

        const referrer = referral.referrer;

        // Credit referrer ₹300
        const updatedReferrer = await tx.driver.update({
          where: { id: referrer.id },
          data: { walletBalance: { increment: 300 } },
        });

        await tx.driverWalletLog.create({
          data: {
            driverId: referrer.id,
            amount: 300,
            reason: 'Referral Completion Bonus',
            beforeBalance: referrer.walletBalance!,
            afterBalance: updatedReferrer.walletBalance!,
          },
        });

        this.logger.log(
          `Successfully applied ₹300 referrer reward to driver ${referrer.id}`,
        );

        // Send notification to referrer
        this.firebaseService.notifyAllSessions(referrer.id, 'driver', {
          data: { event: FcmEventType.WalletChange },
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to apply driver referrer reward: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get referral stats for a customer
   */
  async getCustomerReferralStats(customerId: string): Promise<CustomerReferralStatsDto> {
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
        select: {
          id: true,
          referrerRewardApplied: true,
          createdAt: true,
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              bookingCount: true,
              createdAt: true,
              profileCreatedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      referralCode: customer?.referralCode ?? null,
      totalReferrals: referralCount,
      remainingReferrals: 5 - referralCount, // Unlimited referrals - deprecated field
      maxReferrals: 5, // Unlimited referrals - deprecated field
      referrals: referrals.map((r) => ({
        id: r.id,
        referredCustomer: r.referred,
        referrerRewardApplied: r.referrerRewardApplied,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Get referral stats for a driver
   */
  async getDriverReferralStats(driverId: string): Promise<DriverReferralStatsDto> {
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
        select: {
          id: true,
          referrerRewardApplied: true,
          createdAt: true,
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              photo: true,
              rideCount: true,
              createdAt: true,
              profileCreatedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      referralCode: driver?.referralCode ?? null,
      totalReferrals: referralCount,
      remainingReferrals: 5 - referralCount, // Unlimited referrals - deprecated field
      maxReferrals: 5, // Unlimited referrals - deprecated field
      referrals: referrals.map((r) => ({
        id: r.id,
        referredDriver: r.referred,
        referrerRewardApplied: r.referrerRewardApplied,
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

      return { isValid: true };
    } catch (error) {
      this.logger.error(`Error validating driver referral code: ${error.message}`);
      return { isValid: false, reason: 'Validation error' };
    }
  }
}
