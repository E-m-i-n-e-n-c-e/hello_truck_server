import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../setup/test-app';
import {
  setupTestDatabase,
  closeDatabaseConnection,
  prisma,
} from '../setup/database';
import { loginAsCustomer, loginAsDriver } from '../setup/auth-helper';
import { createBookingRequestDto } from '../factories';
import * as request from 'supertest';

/**
 * WebSocket E2E tests are complex because they require actual server listening.
 * These tests are marked as skipped for CI but can be run manually with a running server.
 *
 * To test WebSocket functionality:
 * 1. Start the server: npm run start:dev
 * 2. Run manual smoke test: npm run test:smoke:realtime
 */
/**
 * @doc test/docs/flows/07-realtime.md
 */
describe('07 - Realtime Updates (E2E)', () => {
  let app: INestApplication;
  let customerToken: string;
  let driverToken: string;
  let driverId: string;
  let bookingId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();

    // Setup customer
    const customerPhone = `99${Date.now().toString().slice(-8)}`;
    const customerTokens = await loginAsCustomer(app, customerPhone);
    customerToken = customerTokens.accessToken;

    await request(app.getHttpServer())
      .post('/customer/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ firstName: 'Test', lastName: 'Customer' });

    // Setup driver with required documents
    const driverPhone = `88${Date.now().toString().slice(-8)}`;
    const driverTokens = await loginAsDriver(app, driverPhone);
    driverToken = driverTokens.accessToken;

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

    // Fetch driver profile to get the ID
    const driverProfileRes = await request(app.getHttpServer())
      .get('/driver/profile')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    driverId = driverProfileRes.body.id;

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
      data: { verificationStatus: 'VERIFIED', driverStatus: 'AVAILABLE' },
    });

    // Create and assign booking
    const bookingData = createBookingRequestDto();
    const bookingRes = await request(app.getHttpServer())
      .post('/bookings/customer')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(bookingData);
    bookingId = bookingRes.body.id;

    const assignment = await prisma.bookingAssignment.create({
      data: {
        booking: { connect: { id: bookingId } },
        driver: { connect: { id: driverId } },
        status: 'OFFERED',
      },
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'DRIVER_ASSIGNED', assignedDriverId: driverId },
    });

    await request(app.getHttpServer())
      .post(`/bookings/driver/accept/${assignment.id}`)
      .set('Authorization', `Bearer ${driverToken}`);
  });

  afterAll(async () => {
    await app.close();
    await closeDatabaseConnection();
  });

  describe('WebSocket Connection', () => {
    // WebSocket tests require actual server listening, which is complex in test environment
    // These are skipped in favor of the smoke test (test/smoke/realtime.smoke.ts)
    it.skip('should connect driver to WebSocket', () => {
      // Requires: npm run start:dev running, then socket.io-client connects
    });

    it.skip('should reject connection without token', () => {
      // Requires: npm run start:dev running, then socket.io-client connects
    });
  });

  describe('Realtime Gateway Validation', () => {
    it('should have booking confirmed for realtime events', async () => {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe('CONFIRMED');
    });

    it('should have driver assigned to booking', async () => {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.assignedDriverId).toBe(driverId);
    });
  });
});
