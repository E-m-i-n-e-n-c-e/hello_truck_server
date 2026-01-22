import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app';
import { setupTestDatabase, closeDatabaseConnection } from '../setup/database';
import { testState } from '../setup/shared-state';

/**
 * @doc test/docs/flows/01-auth.md
 */
describe('01 - Auth (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabaseConnection();
  });

  describe('Customer Auth', () => {
    const customerPhone = `99${Date.now().toString().slice(-8)}`;
    let customerRefreshToken: string;

    it('should send OTP to customer', () => {
      return request(app.getHttpServer())
        .post('/auth/customer/send-otp')
        .send({ phoneNumber: customerPhone })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should verify OTP and return tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/customer/verify-otp')
        .send({ phoneNumber: customerPhone, otp: '123456' })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          
          // Save to shared state and local variable
          testState.customerPhone = customerPhone;
          testState.customerToken = res.body.accessToken;
          customerRefreshToken = res.body.refreshToken;
        });
    });

    it('should reject invalid OTP', async () => {
      // Use a different phone for invalid OTP test
      const newPhone = `97${Date.now().toString().slice(-8)}`;
      await request(app.getHttpServer())
        .post('/auth/customer/send-otp')
        .send({ phoneNumber: newPhone });

      return request(app.getHttpServer())
        .post('/auth/customer/verify-otp')
        .send({ phoneNumber: newPhone, otp: '000000' })
        .expect(400);
    });

    it('should refresh access token', async () => {
      return request(app.getHttpServer())
        .post('/auth/customer/refresh-token')
        .send({ refreshToken: customerRefreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          // Update token for logout test
          testState.customerToken = res.body.accessToken;
        });
    });

    it('should logout customer', () => {
      return request(app.getHttpServer())
        .post('/auth/customer/logout')
        .send({ refreshToken: customerRefreshToken })
        .expect(200);
    });
  });

  describe('Driver Auth', () => {
    const driverPhone = `88${Date.now().toString().slice(-8)}`;
    let driverRefreshToken: string;

    it('should send OTP to driver', () => {
      return request(app.getHttpServer())
        .post('/auth/driver/send-otp')
        .send({ phoneNumber: driverPhone })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should verify OTP and return tokens', () => {
      return request(app.getHttpServer())
        .post('/auth/driver/verify-otp')
        .send({ phoneNumber: driverPhone, otp: '123456' })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          
          // Save to shared state and local variable
          testState.driverPhone = driverPhone;
          testState.driverToken = res.body.accessToken;
          driverRefreshToken = res.body.refreshToken;
        });
    });

    it('should reject invalid OTP', async () => {
      // Use a different phone for invalid OTP test
      const newPhone = `86${Date.now().toString().slice(-8)}`;
      await request(app.getHttpServer())
        .post('/auth/driver/send-otp')
        .send({ phoneNumber: newPhone });

      return request(app.getHttpServer())
        .post('/auth/driver/verify-otp')
        .send({ phoneNumber: newPhone, otp: '000000' })
        .expect(400);
    });

    it('should logout driver', () => {
      return request(app.getHttpServer())
        .post('/auth/driver/logout')
        .send({ refreshToken: driverRefreshToken })
        .expect(200);
    });
  });
});
