import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp/otp.service';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { TokenService } from '../token/token.service';
import { UserType } from 'src/common/types/user-session.types';
import { FirebaseService } from './firebase/firebase.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private otpService: OtpService,
    private tokenService: TokenService,
    private firebaseService: FirebaseService,
  ) {}

  async sendOtp(phoneNumber: string) {
    return this.otpService.sendOtp(phoneNumber);
  }

  async verifyCustomerOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, otp, staleRefreshToken } = verifyOtpDto;

    await this.otpService.verifyOtp(phoneNumber, otp);

    let customer = await this.prisma.customer.findUnique({
      where: { phoneNumber },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { phoneNumber },
      });
    }

    const accessToken = await this.tokenService.generateAccessToken(customer, 'customer');
    const newRefreshToken = await this.tokenService.generateRefreshToken(customer.id, 'customer', staleRefreshToken);
    const firebaseToken = await this.firebaseService.createCustomFirebaseToken(customer.id);
    return { accessToken, refreshToken: newRefreshToken, firebaseToken };
  }

  async logoutCustomer(refreshToken: string) {
    if (!refreshToken || !refreshToken.includes('.')) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const [sessionId] = refreshToken.split('.', 2);
    await this.prisma.customerSession.deleteMany({
      where: { id: sessionId },
    });

    return { success: true, message: 'Logged out successfully' };
  }

  async verifyDriverOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, otp, staleRefreshToken } = verifyOtpDto;

    await this.otpService.verifyOtp(phoneNumber, otp);

    let driver = await this.prisma.driver.findUnique({
      where: { phoneNumber },
    });

    if (!driver) {
      driver = await this.prisma.driver.create({
        data: { phoneNumber },
      });
    }

    const accessToken = await this.tokenService.generateAccessToken(driver, 'driver');
    const newRefreshToken = await this.tokenService.generateRefreshToken(driver.id, 'driver', staleRefreshToken);
    const firebaseToken = await this.firebaseService.createCustomFirebaseToken(driver.id);
    return { accessToken, refreshToken: newRefreshToken, firebaseToken };
  }

  async logoutDriver(refreshToken: string) {
    if (!refreshToken || !refreshToken.includes('.')) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const [sessionId] = refreshToken.split('.', 2);
    await this.prisma.driverSession.deleteMany({
      where: { id: sessionId },
    });

    return { success: true, message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string, userType: UserType) {
    const { accessToken, refreshToken: newRefreshToken } = await this.tokenService.refreshAccessToken(refreshToken, userType);
    return { accessToken, refreshToken: newRefreshToken };
  }
}
