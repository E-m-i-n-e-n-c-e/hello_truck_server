import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto, CreateProfileDto } from '../dtos/profile.dto';
import { GstService } from '../gst/gst.service';
import { AddressService } from '../address/address.service';
import { Customer } from '@prisma/client';
import { FirebaseService } from 'src/firebase/firebase.service';
import { ReferralService } from 'src/referral/referral.service';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private gstService: GstService,
    private addressService: AddressService,
    private firebaseService: FirebaseService,
    private referralService: ReferralService,
  ) {}

  async getProfile(userId: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { googleIdToken, ...profileData } = updateProfileDto;
    let email: string | undefined;
    if (googleIdToken) {
      email =
        await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    await this.prisma.customer.update({
      where: { id: userId },
      data: {
        ...profileData,
        ...(email && { email }),
      },
    });

    return { success: true, message: 'Profile updated successfully' };
  }

  async createProfile(userId: string, createProfileDto: CreateProfileDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.firstName) {
      throw new BadRequestException('Profile already exists');
    }

    const {
      googleIdToken,
      gstDetails,
      savedAddress,
      appliedReferralCode,
      ...profileData
    } = createProfileDto;
    let email: string | undefined;
    if (googleIdToken) {
      email =
        await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    await this.prisma.$transaction(async (tx) => {
      if (gstDetails) {
        await this.gstService.addGstDetails(userId, gstDetails, tx);
      }

      if (savedAddress) {
        await this.addressService.createSavedAddress(userId, savedAddress, tx);
      }

      await tx.customer.update({
        where: { id: userId },
        data: {
          ...profileData,
          isBusiness: gstDetails ? true : false,
          ...(email && { email }),
        },
      });
    });

    // Apply referral code if provided
    if (appliedReferralCode) {
      this.referralService
        .applyCustomerReferralCode(appliedReferralCode, userId)
        .catch((error) => {
          console.error(
            `Failed to apply referral code for customer ${userId}:`,
            error,
          );
        });
    }

    return { success: true, message: 'Profile created successfully' };
  }

  async upsertFcmToken(sessionId: string, fcmToken: string) {
    await this.firebaseService.upsertFcmToken({
      sessionId,
      fcmToken,
      userType: 'customer',
    });
  }

  async getWalletLogs(userId: string) {
    const logs = await this.prisma.customerWalletLog.findMany({
      where: { customerId: userId },
      include: {
        refundIntent: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs;
  }

  async getTransactionLogs(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { customerId: userId },
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
        refundIntent: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return transactions;
  }

  async getPendingRefunds(userId: string) {
    const refunds = await this.prisma.refundIntent.findMany({
      where: {
        customerId: userId,
        status: { in: ['PENDING', 'FAILED'] },
      },
      include: {
        booking: {
          include: {
            pickupAddress: true,
            dropAddress: true,
            package: true,
            invoices: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return refunds;
  }
}
