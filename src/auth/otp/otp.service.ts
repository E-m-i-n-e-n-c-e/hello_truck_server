import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { randomInt } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OtpService {
  private readonly OTP_EXPIRY_SECONDS = 60; // 60 seconds
  private readonly MAX_RETRY_COUNT = 5;

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  // Send OTP
  async sendOtp(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    // Generate OTP
    // const otp = randomInt(100000, 999999).toString(); // 6-digit OTP
    const otp = '123456';
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Create OTP data object
    const otpData = {
      otp: hashedOtp,
      retryCount: 0,
      createdAt: Date.now(),
      phoneNumber: phoneNumber,
    };

    // Store in Redis with expiration
    await this.redisService.set(`otp:${phoneNumber}`, JSON.stringify(otpData), 'EX', this.OTP_EXPIRY_SECONDS);

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
    const key = `otp:${phoneNumber}`;
    const otpDataStr = await this.redisService.get(key);
    const otpData = JSON.parse(otpDataStr || '{}');

    if (!otpDataStr || !otpData || !otpData.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const retryCount = otpData.retryCount || 0;
    if(retryCount >= this.MAX_RETRY_COUNT) {
      await this.redisService.del(key);
      throw new BadRequestException('Too many attempts, please request a new OTP');
    }

    const isValidOtp = await bcrypt.compare(otp, otpData.otp);
    if (!isValidOtp) {
      const ttl = await this.redisService.ttl(key);
      await this.redisService.set(
        key,
        JSON.stringify({ ...otpData, retryCount: retryCount + 1 }),
        'EX',
        (typeof ttl === 'number' && ttl > 0) ? ttl : this.OTP_EXPIRY_SECONDS
      );
      throw new BadRequestException('Invalid OTP');
    }

    // Delete verified OTP
    await this.redisService.del(key);

    return true;
  }
}
