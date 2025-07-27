import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import { UpdateProfileDto, CreateDriverProfileDto } from '../dtos/profile.dto';
import { Driver } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';

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
  ) {}

  async getProfile(
    userId: string,
    options: GetProfileOptions,
  ): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: userId },
      include: {
        documents: options.includeDocuments ?? false,
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

    const { googleIdToken, documents, ...profileData } = createProfileDto;
    let email: string | undefined;
    if (googleIdToken) {
      email = await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    await this.prisma.$transaction(async (tx) => {
      // Create documents
      await this.documentsService.createDocuments(userId, documents, tx);

      // Update driver profile
      await tx.driver.update({
        where: { id: userId },
        data: {
          ...profileData,
          ...(email && { email }),
        },
      });
    });

    return { success: true, message: 'Profile created successfully' };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { googleIdToken, ...profileData } = updateProfileDto;

    // Extract email from Google ID token if provided
    let email: string | undefined;
    if (googleIdToken) {
      email = await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    await this.prisma.driver.update({
      where: { id: userId },
      data: {
        ...profileData,
        ...(email && { email }),
      },
    });

    return { success: true, message: 'Profile updated successfully' };
  }
}