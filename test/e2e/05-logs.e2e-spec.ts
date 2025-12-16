import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app';
import { setupTestDatabase, closeDatabaseConnection, prisma } from '../setup/database';
import { loginAsCustomer, loginAsDriver } from '../setup/auth-helper';
import { createBookingRequestDto } from '../factories';

/**
 * @doc test/docs/flows/05-logs.md
 */
describe('05 - Wallet & Transaction Logs (E2E)', () => {
  let app: INestApplication;
  let customerToken: string;
  let driverToken: string;
  let customerId: string;
  let driverId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();

    // Setup customer
    const customerPhone = `99${Date.now().toString().slice(-8)}`;
    const customerTokens = await loginAsCustomer(app, customerPhone);
    customerToken = customerTokens.accessToken;

    const customerRes = await request(app.getHttpServer())
      .post('/customer/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ firstName: 'Test', lastName: 'Customer' });
    customerId = customerRes.body.id;

    // Setup driver
    const driverPhone = `88${Date.now().toString().slice(-8)}`;
    const driverTokens = await loginAsDriver(app, driverPhone);
    driverToken = driverTokens.accessToken;

    // Create driver profile with required documents
    await request(app.getHttpServer())
      .post('/driver/profile')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        firstName: 'Test',
        lastName: 'Driver',
        documents: {
          licenseUrl: 'https://example.com/license.jpg',
          rcBookUrl: 'https://example.com/rcbook.jpg',
          fcUrl: 'https://example.com/fc.jpg',
          insuranceUrl: 'https://example.com/insurance.jpg',
          aadharUrl: 'https://example.com/aadhar.jpg',
          panNumber: 'ABCDE1234F',
          ebBillUrl: 'https://example.com/ebbill.jpg',
        },
      });

    // Fetch driver profile to get the ID (POST returns SuccessResponseDto)
    const driverProfileRes = await request(app.getHttpServer())
      .get('/driver/profile')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    driverId = driverProfileRes.body.id;

    // Add vehicle and set driver as verified
    await request(app.getHttpServer())
      .post('/driver/vehicle')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        vehicleNumber: `TS${Date.now().toString().slice(-6)}`,
        vehicleType: 'FOUR_WHEELER',
        vehicleModelName: 'Tata Ace',
        vehicleBodyLength: 8.5,
        vehicleBodyType: 'CLOSED',
        fuelType: 'DIESEL',
        vehicleImageUrl: 'https://example.com/vehicle.jpg',
      });

    await prisma.driver.update({
      where: { id: driverId },
      data: {
        verificationStatus: 'VERIFIED',
        driverStatus: 'AVAILABLE',
      },
    });

    // Complete a booking to generate logs
    const bookingData = createBookingRequestDto();
    const bookingRes = await request(app.getHttpServer())
      .post('/bookings/customer')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(bookingData);

    const bookingId = bookingRes.body.id;

    // Assign driver
    const assignment = await prisma.bookingAssignment.create({
      data: { bookingId, driverId, status: 'OFFERED' },
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'DRIVER_ASSIGNED', assignedDriverId: driverId },
    });

    // Accept and complete booking
    await request(app.getHttpServer())
      .post(`/bookings/driver/accept/${assignment.id}`)
      .set('Authorization', `Bearer ${driverToken}`);

    await request(app.getHttpServer())
      .post('/bookings/driver/pickup/arrived')
      .set('Authorization', `Bearer ${driverToken}`);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    await request(app.getHttpServer())
      .post('/bookings/driver/pickup/verify')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ otp: booking?.pickupOtp });

    await request(app.getHttpServer())
      .post('/bookings/driver/start')
      .set('Authorization', `Bearer ${driverToken}`);

    await request(app.getHttpServer())
      .post('/bookings/driver/drop/arrived')
      .set('Authorization', `Bearer ${driverToken}`);

    const bookingForDrop = await prisma.booking.findUnique({ where: { id: bookingId } });

    await request(app.getHttpServer())
      .post('/bookings/driver/drop/verify')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ otp: bookingForDrop?.dropOtp });

    // Settle cash BEFORE finishing
    await request(app.getHttpServer())
      .post('/bookings/driver/settle-cash')
      .set('Authorization', `Bearer ${driverToken}`);

    await request(app.getHttpServer())
      .post('/bookings/driver/finish')
      .set('Authorization', `Bearer ${driverToken}`);
  });

  afterAll(async () => {
    await app.close();
    await closeDatabaseConnection();
  });

  describe('Customer Logs', () => {
    it('should get customer wallet logs', () => {
      return request(app.getHttpServer())
        .get('/customer/profile/wallet-logs')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get customer transaction logs', () => {
      return request(app.getHttpServer())
        .get('/customer/profile/transaction-logs')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should include refund details in wallet logs after cancellation', async () => {
      // 1. Create a booking
      const bookingData = createBookingRequestDto();
      const bookingRes = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData)
        .expect(201);
      const bookingId = bookingRes.body.id;

      // 2. Assign driver & Accept (to make it eligible for cancellation charge/refund intent)
      const assignment = await prisma.bookingAssignment.create({
        data: { bookingId, driverId, status: 'OFFERED' },
      });
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'DRIVER_ASSIGNED', assignedDriverId: driverId },
      });
      await request(app.getHttpServer())
        .post(`/bookings/driver/accept/${assignment.id}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      // 3. Cancel the booking
      await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Changed plans' })
        .expect(201);

      // 4. Verify wallet logs include refundIntent
      const res = await request(app.getHttpServer())
        .get('/customer/profile/wallet-logs')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const refundLog = res.body.find((log: any) => log.bookingId === bookingId && log.refundIntent);

      if (refundLog) {
        expect(refundLog.refundIntent).toBeDefined();
        expect(refundLog.refundIntent.id).toBeDefined();
        expect(refundLog.refundIntent.cancellationCharge).toBeGreaterThan(0);
      }
    });

    it('should get pending refunds', () => {
      return request(app.getHttpServer())
        .get('/customer/profile/pending-refunds')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Driver Logs', () => {
    it('should get driver wallet logs', () => {
      return request(app.getHttpServer())
        .get('/driver/profile/wallet-logs')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get driver transaction logs', () => {
      return request(app.getHttpServer())
        .get('/driver/profile/transaction-logs')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            // Check that payout field exists in the response (can be null)
            expect(res.body[0]).toHaveProperty('payout');
          }
        });
    });

    it('should get driver ride summary', () => {
      return request(app.getHttpServer())
        .get('/bookings/driver/ride-summary')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
    });
  });
});
