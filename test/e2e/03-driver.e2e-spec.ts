import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app';
import { setupTestDatabase, closeDatabaseConnection } from '../setup/database';
import { loginAsDriver } from '../setup/auth-helper';
import { testState } from '../setup/shared-state';

/**
 * @doc test/docs/flows/03-driver.md
 */
describe('03 - Driver Profile (E2E)', () => {
  let app: INestApplication;
  let driverToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
    
    // Login as driver (creates a driver record with null firstName)
    const driverPhone = `88${Date.now().toString().slice(-8)}`;
    const tokens = await loginAsDriver(app, driverPhone);
    driverToken = tokens.accessToken;
    testState.driverPhone = driverPhone;
    testState.driverToken = driverToken;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabaseConnection();
  });

  describe('Profile', () => {
    // After auth, a driver record exists with null firstName (uninitialized profile)
    it('should return profile with null firstName before profile is created', () => {
      return request(app.getHttpServer())
        .get('/driver/profile')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          // Driver record exists from auth, but firstName is null (not fully created)
          expect(res.body.firstName).toBeNull();
        });
    });

    it('should create driver profile', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);

      return request(app.getHttpServer())
        .post('/driver/profile')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          firstName: 'Test',
          lastName: 'Driver',
          // documents is required by CreateDriverProfileDto
          documents: {
            licenseUrl: 'https://example.com/license.jpg',
            rcBookUrl: 'https://example.com/rcbook.jpg',
            fcUrl: 'https://example.com/fc.jpg',
            insuranceUrl: 'https://example.com/insurance.jpg',
            aadharUrl: 'https://example.com/aadhar.jpg',
            panNumber: 'ABCDE1234F',
            ebBillUrl: 'https://example.com/ebbill.jpg',
          },
        })
        .expect(201)
        .expect((res) => {
          // createProfile returns SuccessResponseDto, not ProfileResponseDto
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Profile created successfully');
        });
    });

    it('should get driver profile', () => {
      return request(app.getHttpServer())
        .get('/driver/profile')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.firstName).toBe('Test');
          expect(res.body.lastName).toBe('Driver');
          testState.driverId = res.body.id;
        });
    });

    it('should update driver profile', () => {
      return request(app.getHttpServer())
        .put('/driver/profile')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          firstName: 'Updated Driver',
        })
        .expect(200)
        .expect((res) => {
          // updateProfile returns SuccessResponseDto, not ProfileResponseDto
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Profile updated successfully');
        });
    });

    it('should verify profile was updated', () => {
      return request(app.getHttpServer())
        .get('/driver/profile')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.firstName).toBe('Updated Driver');
        });
    });

    it('should update driver status', () => {
      return request(app.getHttpServer())
        .put('/driver/profile/status')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          status: 'AVAILABLE',
        })
        .expect(200)
        .expect((res) => {
          // updateDriverStatus returns SuccessResponseDto
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Driver status updated successfully');
        });
    });

    it('should verify driver status was updated', () => {
      return request(app.getHttpServer())
        .get('/driver/profile')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.driverStatus).toBe('AVAILABLE');
        });
    });
  });

  describe('Vehicle', () => {
    it('should get vehicle models', () => {
      return request(app.getHttpServer())
        .get('/driver/vehicle/models')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });

    it('should add vehicle', () => {
      return request(app.getHttpServer())
        .post('/driver/vehicle')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicleNumber: 'TS01AB1234',
          vehicleType: 'FOUR_WHEELER',
          vehicleModelName: 'Tata Ace',
          vehicleBodyLength: 8.5,
          vehicleBodyType: 'CLOSED',
          fuelType: 'DIESEL',
          vehicleImageUrl: 'https://example.com/vehicle.jpg',
        })
        // POST typically returns 201 Created (NestJS default for @Post)
        .expect(201)
        .expect((res) => {
          expect(res.body.vehicleNumber).toBe('TS01AB1234');
        });
    });

    it('should get vehicle', () => {
      return request(app.getHttpServer())
        .get('/driver/vehicle')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.vehicleNumber).toBe('TS01AB1234');
        });
    });

    it('should update vehicle', () => {
      return request(app.getHttpServer())
        .put('/driver/vehicle')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicleBodyType: 'OPEN',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.vehicleBodyType).toBe('OPEN');
        });
    });
  });

  describe('Documents', () => {
    // Documents are created with the profile, so we can get them directly
    it('should get documents', () => {
      return request(app.getHttpServer())
        .get('/driver/documents')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.licenseUrl).toBeDefined();
          expect(res.body.panNumber).toBe('ABCDE1234F');
        });
    });

    it('should update documents', () => {
      return request(app.getHttpServer())
        .put('/driver/documents')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          licenseUrl: 'https://example.com/license-updated.jpg',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.licenseUrl).toBe('https://example.com/license-updated.jpg');
        });
    });

    it('should get upload url', () => {
      return request(app.getHttpServer())
        .get('/driver/documents/upload-url')
        .query({ filePath: 'drivers/license.jpg', type: 'image/jpeg' })
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.signedUrl).toBeDefined();
          expect(res.body.publicUrl).toBeDefined();
        });
    });
  });

  describe('Address', () => {
    it('should create driver address', () => {
      return request(app.getHttpServer())
        .post('/driver/address')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          addressLine1: '123 Driver St',
          pincode: '500001',
          city: 'Hyderabad',
          district: 'Hyderabad',
          state: 'Telangana',
        })
        // POST typically returns 201 Created (NestJS default for @Post)
        .expect(201)
        .expect((res) => {
          expect(res.body.city).toBe('Hyderabad');
        });
    });

    it('should get driver address', () => {
      return request(app.getHttpServer())
        .get('/driver/address')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.city).toBe('Hyderabad');
        });
    });

    it('should update driver address', () => {
      return request(app.getHttpServer())
        .put('/driver/address')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          city: 'Secunderabad',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.city).toBe('Secunderabad');
        });
    });
  });
});
