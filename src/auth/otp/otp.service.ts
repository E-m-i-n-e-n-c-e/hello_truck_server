import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { randomInt } from 'crypto';
import { ConfigService } from '@nestjs/config';

// Run npm install bcrypt and npm install @types/bcrypt --save-dev

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService, // Assuming you have a config service for environment variables
  ) {}

  // Send OTP
  async sendOtp(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    // Generate OTP
    // const otp = randomInt(100000, 999999).toString(); // 6-digit OTP
    const otp = '123456';
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 60 * 1000); // OTP valid for 60 seconds

    // Store OTP in database
    await this.prisma.otpVerification.create({
      data: {
        phoneNumber,
        otp:hashedOtp,
        expiresAt,
      },
    });
    // Send OTP via SMS using 2Factor API
    const apiKey = this.configService.get<string>('TWO_FACTOR_API_KEY');
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/+91${phoneNumber}/${otp}/HelloTruckOtpTemplate`;

    console.log(`Sending OTP to ${phoneNumber} via URL: ${url}`);
    // try {
    //   const response = await axios.get(url);
    //   if (response.data.Status !== 'Success') {
    //     throw new InternalServerErrorException('Failed to send OTP');
    //   }
    // } catch (error) {
    //   throw new BadRequestException(error.message);
    // }

    console.log(`OTP for ${phoneNumber}: ${otp}`);

    return {
      success: true,
      message: 'OTP sent successfully'
    };
  }

  // Verify OTP
  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    // Find the most recent OTP for this phone number
    const otpVerification = await this.prisma.otpVerification.findFirst({
      where: {
        phoneNumber,
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpVerification) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const isValidOtp = await bcrypt.compare(otp, otpVerification.otp);
    if (!isValidOtp) {
      await this.prisma.otpVerification.update({
      where: { id: otpVerification.id },
      data: { retryCount: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP');
    }

    if( otpVerification.retryCount > 5) {
      throw new BadRequestException('Too many attempts, please request a new OTP');
    }

    // Mark OTP as verified
    await this.prisma.otpVerification.update({
      where: { id: otpVerification.id },
      data: { verified: true },
    });

    return true;
  }
}
