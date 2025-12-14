import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

const TEST_OTP = '123456'; // Hardcoded in OtpService for dev/test mode

/**
 * Login as customer and return access token
 */
export async function loginAsCustomer(
  app: INestApplication,
  phoneNumber: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Send OTP
  await request(app.getHttpServer())
    .post('/auth/customer/send-otp')
    .send({ phoneNumber })
    .expect(200);

  // Verify OTP
  const response = await request(app.getHttpServer())
    .post('/auth/customer/verify-otp')
    .send({ phoneNumber, otp: TEST_OTP })
    .expect(200);

  return {
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
}

/**
 * Login as driver and return access token
 */
export async function loginAsDriver(
  app: INestApplication,
  phoneNumber: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Send OTP
  await request(app.getHttpServer())
    .post('/auth/driver/send-otp')
    .send({ phoneNumber })
    .expect(200);

  // Verify OTP
  const response = await request(app.getHttpServer())
    .post('/auth/driver/verify-otp')
    .send({ phoneNumber, otp: TEST_OTP })
    .expect(200);

  return {
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
  };
}
