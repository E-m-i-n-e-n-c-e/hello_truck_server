import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateReferralCode } from '../common/utils/referral-code.util';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly MAX_REFERRALS = 5;
  private readonly MAX_RETRIES = 5;

  constructor(private prisma: PrismaService) {}

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

      this.logger.log(
        `Successfully applied referral code ${referralCode} for customer ${newCustomerId}`,
      );
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

      this.logger.log(
        `Successfully applied referral code ${referralCode} for driver ${newDriverId}`,
      );
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
}
