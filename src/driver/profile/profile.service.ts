import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from 'src/firebase/firebase.service';
import {
  UpdateDriverProfileDto,
  CreateDriverProfileDto,
  UpdateLocationDto,
} from '../dtos/profile.dto';
import {
  Driver,
  DriverStatus,
  PayoutMethodType,
  TransactionCategory,
} from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { AddressService } from '../address/address.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';
import { RedisService } from 'src/redis/redis.service';
import { ReferralService } from 'src/referral/referral.service';
import { PayoutMethod } from 'src/razorpay/dtos/payout-details.dto';

interface GetProfileOptions {
  includeDocuments?: boolean;
  includeVehicle?: boolean;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly documentsService: DocumentsService,
    private readonly vehicleService: VehicleService,
    private readonly addressService: AddressService,
    private readonly razorpayService: RazorpayService,
    private readonly redisService: RedisService,
    private readonly referralService: ReferralService,
  ) {}

  async getProfile(
    userId: string,
    options: GetProfileOptions,
  ): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: userId },
      include: {
        documents: options.includeDocuments ?? false,
        vehicle: options.includeVehicle ?? false,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  async createProfile(
    userId: string,
    createProfileDto: CreateDriverProfileDto,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (driver.firstName) {
      throw new BadRequestException('Profile already exists');
    }

    const {
      googleIdToken,
      documents,
      vehicle,
      address,
      payoutDetails,
      appliedReferralCode,
      ...profileData
    } = createProfileDto;
    let email: string | undefined;
    if (googleIdToken) {
      email =
        await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    await this.prisma.$transaction(async (tx) => {
      // Create documents
      await this.documentsService.createDocuments(userId, documents, tx);

      // Create vehicle if provided
      if (vehicle) {
        await this.vehicleService.createVehicle(userId, vehicle, tx);
      }

      // Create address if provided
      if (address) {
        await this.addressService.createAddress(userId, address, tx);
      }

      // Create payout details if provided
      let contactId: string | null = null;
      let fundAccountId: string | null = null;
      let payoutMethodType: PayoutMethodType | null = null;

      if (payoutDetails) {
        const driverName = profileData.lastName
          ? `${profileData.firstName} ${profileData.lastName}`
          : profileData.firstName;
        contactId = await this.razorpayService.createContact(
          driver.phoneNumber,
          driverName,
        );
        fundAccountId = await this.razorpayService.createFundAccount(
          contactId,
          payoutDetails,
        );
        // Map DTO payoutMethod to Prisma enum
        payoutMethodType =
          payoutDetails.payoutMethod === PayoutMethod.VPA
            ? 'VPA'
            : 'BANK_ACCOUNT';
      }

      // Update driver profile
      await tx.driver.update({
        where: { id: userId },
        data: {
          ...profileData,
          ...(email && { email }),
          ...(contactId && { contactId }),
          ...(fundAccountId && { fundAccountId }),
          ...(payoutMethodType && { payoutMethod: payoutMethodType }),
        },
      });
    });

    // Apply referral code if provided
    if (appliedReferralCode) {
      this.referralService
        .applyDriverReferralCode(appliedReferralCode, userId)
        .catch((error) => {
          console.error(
            `Failed to apply referral code for driver ${userId}:`,
            error,
          );
        });
    }

    return { success: true, message: 'Profile created successfully' };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateDriverProfileDto,
  ) {
    const { googleIdToken, payoutDetails, ...profileData } = updateProfileDto;

    const driver = await this.prisma.driver.findUnique({
      where: { id: userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // Extract email from Google ID token if provided
    let email: string | undefined;
    if (googleIdToken) {
      email =
        await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    // Create payout details if provided
    let contactId: string | null = null;
    let fundAccountId: string | null = null;
    let payoutMethodType: PayoutMethodType | null = null;

    if (payoutDetails) {
      const driverName = profileData.lastName
        ? `${profileData.firstName} ${profileData.lastName}`
        : profileData.firstName;
      contactId = await this.razorpayService.createContact(
        driver.phoneNumber,
        driverName,
      );
      fundAccountId = await this.razorpayService.createFundAccount(
        contactId,
        payoutDetails,
      );
      // Map DTO payoutMethod to Prisma enum
      payoutMethodType =
        payoutDetails.payoutMethod === PayoutMethod.VPA
          ? 'VPA'
          : 'BANK_ACCOUNT';
    }

    await this.prisma.driver.update({
      where: { id: userId },
      data: {
        ...profileData,
        ...(email && { email }),
        ...(contactId && { contactId }),
        ...(fundAccountId && { fundAccountId }),
        ...(payoutMethodType && { payoutMethod: payoutMethodType }),
      },
    });

    return { success: true, message: 'Profile updated successfully' };
  }

  async updateDriverStatus(userId: string, status: DriverStatus) {
    // Fetch current driver status
    const driver = await this.prisma.driver.findUnique({
      where: { id: userId },
      select: { driverStatus: true },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (
      driver.driverStatus === 'ON_RIDE' ||
      driver.driverStatus === 'RIDE_OFFERED'
    ) {
      throw new BadRequestException(
        'Cannot update status while driver is on a ride or has a ride offered',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Update the driver's status
      await tx.driver.update({
        where: { id: userId },
        data: { driverStatus: status },
      });

      // Log the status change
      await tx.driverStatusLog.create({
        data: {
          driverId: userId,
          status: status,
        },
      });
    });

    return { success: true, message: 'Driver status updated successfully' };
  }

  async upsertFcmToken(sessionId: string, fcmToken: string) {
    await this.firebaseService.upsertFcmToken({
      sessionId,
      fcmToken,
      userType: 'driver',
    });
  }

  async updateLocation(userId: string, updateLocationDto: UpdateLocationDto) {
    await this.redisService
      .multi()
      .setex(`driver:${userId}:lastSeen`, 30, '1') // TTL auto-expires after 30s
      .geoadd(
        'active_drivers',
        Number(updateLocationDto.longitude),
        Number(updateLocationDto.latitude),
        userId,
      )
      .exec();
  }

  async getWalletLogs(userId: string) {
    const logs = await this.prisma.driverWalletLog.findMany({
      where: { driverId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs;
  }

  async getTransactionLogs(userId: string, includePayments: boolean = false) {
    // Build category filter
    const categoryFilter = includePayments
      ? undefined // Include all categories
      : { in: [TransactionCategory.DRIVER_PAYOUT] }; // Only payouts (exclude DRIVER_PAYMENT)

    const transactions = await this.prisma.transaction.findMany({
      where: {
        driverId: userId,
        ...(categoryFilter && { category: categoryFilter }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            package: true,
            pickupAddress: true,
            dropAddress: true,
            invoices: true,
          },
        },
        payout: true,
      },
      take: 50,
    });

    return transactions;
  }
}
