import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FirebaseService } from 'src/auth/firebase/firebase.service';
import { UpdateProfileDto } from '../dtos/profile.dto';
import { Driver } from '@prisma/client';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async getProfile(userId: string): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: userId },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
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