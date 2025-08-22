import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import { UpdateProfileDto, CreateDriverProfileDto } from '../dtos/profile.dto';
import { Driver, DriverStatus } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { AddressService } from '../address/address.service';
import { RazorpayService } from 'src/razorpay/razorpay.service';

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

    const { googleIdToken, documents, vehicle, address, payoutDetails, ...profileData } = createProfileDto;
    let email: string | undefined;
    if (googleIdToken) {
      email = await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
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

      if (payoutDetails) {
        const driverName = profileData.lastName
          ? `${profileData.firstName} ${profileData.lastName}`
          : profileData.firstName;
        contactId = await this.razorpayService.createContact(driver.phoneNumber, driverName);
        fundAccountId = await this.razorpayService.createFundAccount(contactId, payoutDetails);
      }

      // Update driver profile
      await tx.driver.update({
        where: { id: userId },
        data: {
          ...profileData,
          ...(email && { email }),
          ...(contactId && { contactId }),
          ...(fundAccountId && { fundAccountId }),
        },
      });
    });

    return { success: true, message: 'Profile created successfully' };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
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
      email = await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    // Create payout details if provided
    let contactId: string | null = null;
    let fundAccountId: string | null = null
    if (payoutDetails) {
      const driverName = profileData.lastName
        ? `${profileData.firstName} ${profileData.lastName}`
        : profileData.firstName;
      contactId = await this.razorpayService.createContact(driver.phoneNumber, driverName);
      fundAccountId = await this.razorpayService.createFundAccount(contactId, payoutDetails);
    }

    await this.prisma.driver.update({
      where: { id: userId },
      data: {
        ...profileData,
        ...(email && { email }),
        ...(contactId && { contactId }),
        ...(fundAccountId && { fundAccountId }),
      },
    });

    return { success: true, message: 'Profile updated successfully' };
  }

  async updateDriverStatus(userId: string, status: DriverStatus) {
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
    await this.firebaseService.upsertFcmToken({sessionId, fcmToken, userType: 'driver'});
  }
}