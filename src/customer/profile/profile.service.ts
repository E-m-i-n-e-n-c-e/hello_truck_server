import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto, CreateProfileDto } from '../dtos/profile.dto';
import { GstService } from '../gst/gst.service';
import { Customer } from '@prisma/client';
import { FirebaseService } from 'src/auth/firebase/firebase.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService, private gstService: GstService, private firebaseService: FirebaseService) {}

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

    const {googleIdToken, ...profileData } = updateProfileDto;
    let email: string | undefined;
    if(googleIdToken) {
      email = await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    await this.prisma.customer.update({
      where: { id: userId },
      data: {
        ...profileData,
        ...(email && { email }),
      }
    });

    return {success:true, message:'Profile updated successfully'};
  }

  async createProfile(userId: string, createProfileDto: CreateProfileDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: userId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if(customer.firstName) {
      throw new BadRequestException('Profile already exists');
    }

    const {googleIdToken, gstDetails, ...profileData } = createProfileDto;
    let email: string | undefined;
    if(googleIdToken) {
      email = await this.firebaseService.getEmailFromGoogleIdToken(googleIdToken);
    }

    await this.prisma.$transaction(async (tx) => {
      if(gstDetails) {
        await this.gstService.addGstDetails(userId, gstDetails, tx);
      }
      await tx.customer.update({
        where: { id: userId },
        data: {
          ...profileData,
          isBusiness: gstDetails ? true : false,
          ...(email && { email }),
        }
      });
    });
    return {success:true, message:'Profile created successfully'};
  }
}
