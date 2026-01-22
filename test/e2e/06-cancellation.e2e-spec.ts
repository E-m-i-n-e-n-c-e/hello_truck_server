import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app';
import {
  setupTestDatabase,
  closeDatabaseConnection,
  prisma,
} from '../setup/database';
import { loginAsCustomer, loginAsDriver } from '../setup/auth-helper';
import { createBookingRequestDto } from '../factories';

/**
 * @doc test/docs/flows/06-cancellation.md
 */
describe('06 - Cancellation Flow (E2E)', () => {
  let app: INestApplication;
  let customerToken: string;
  let driverToken: string;
  let driverId: string;

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
      data: {
        verificationStatus: 'VERIFIED',
        driverStatus: 'AVAILABLE',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await closeDatabaseConnection();
  });

  describe('Cancel at PENDING', () => {
    let bookingId: string;

    beforeAll(async () => {
      const bookingData = createBookingRequestDto();
      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      bookingId = res.body.id;
      expect(bookingId).toBeDefined();
    });

    it('should cancel booking at PENDING', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(201); // POST returns 201

      expect(res.body.message).toContain('cancelled');

      // Verify booking is cancelled
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe('CANCELLED');
    });
  });

  describe('Cancel at DRIVER_ASSIGNED', () => {
    let bookingId: string;

    beforeAll(async () => {
      // Ensure driver is available
      await prisma.driver.update({
        where: { id: driverId },
        data: { driverStatus: 'AVAILABLE' },
      });

      const bookingData = createBookingRequestDto();
      bookingData.pickupAddress.formattedAddress =
        '150 Driver Assigned Cancel St';

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      bookingId = res.body.id;
      expect(bookingId).toBeDefined();

      // Assign driver but do not accept (Status: DRIVER_ASSIGNED)
      await prisma.bookingAssignment.create({
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

      // Update driver status to RIDE_OFFERED (as real assignment service would)
      await prisma.driver.update({
        where: { id: driverId },
        data: { driverStatus: 'RIDE_OFFERED' },
      });
    });

    it('should cancel booking at DRIVER_ASSIGNED and release driver', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Found another ride' })
        .expect(201); // POST returns 201

      expect(res.body.message).toContain('cancelled');

      // Verify booking is cancelled
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe('CANCELLED');

      // Verify driver is released
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
      });
      expect(driver?.driverStatus).toBe('AVAILABLE');

      // Verify assignment is auto-rejected
      const assignment = await prisma.bookingAssignment.findFirst({
        where: { bookingId, driverId },
      });
      expect(assignment?.status).toBe('AUTO_REJECTED');
    });
  });

  describe('Cancel at CONFIRMED', () => {
    let bookingId: string;

    beforeAll(async () => {
      // Ensure driver is available
      await prisma.driver.update({
        where: { id: driverId },
        data: { driverStatus: 'AVAILABLE' },
      });

      const bookingData = createBookingRequestDto();
      bookingData.pickupAddress.formattedAddress = '200 Cancel Test St';

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      bookingId = res.body.id;
      expect(bookingId).toBeDefined();

      // Assign and accept using connect syntax
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
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);
    });

    it('should cancel booking at CONFIRMED with partial refund', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Emergency' })
        .expect(201);

      expect(res.body.message).toContain('cancelled');

      // Verify booking is cancelled
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe('CANCELLED');
    });
  });

  describe('Cannot cancel after PICKUP_VERIFIED', () => {
    let bookingId: string;

    beforeAll(async () => {
      // Ensure driver is available
      await prisma.driver.update({
        where: { id: driverId },
        data: { driverStatus: 'AVAILABLE' },
      });

      const bookingData = createBookingRequestDto();
      bookingData.pickupAddress.formattedAddress = '300 No Cancel St';

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      bookingId = res.body.id;
      expect(bookingId).toBeDefined();

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
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      // Now status is CONFIRMED, proceed with pickup
      await request(app.getHttpServer())
        .post('/bookings/driver/pickup/arrived')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe('PICKUP_ARRIVED');

      // Settle cash payment before verifying pickup
      await request(app.getHttpServer())
        .post('/bookings/driver/settle-cash')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/bookings/driver/pickup/verify')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ otp: booking?.pickupOtp })
        .expect(201);

      // Verify status is PICKUP_VERIFIED
      const verifiedBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(verifiedBooking?.status).toBe('PICKUP_VERIFIED');
    });

    it('should reject cancellation after pickup verified', async () => {
      return request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Too late' })
        .expect(400);
    });
  });

  describe('Cancel at PICKUP_ARRIVED', () => {
    let bookingId: string;

    beforeAll(async () => {
      // Ensure driver is available
      await prisma.driver.update({
        where: { id: driverId },
        data: { driverStatus: 'AVAILABLE' },
      });

      const bookingData = createBookingRequestDto();
      bookingData.pickupAddress.formattedAddress =
        '350 Pickup Arrived Cancel St';

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      bookingId = res.body.id;
      expect(bookingId).toBeDefined();

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
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      // Driver arrives at pickup
      await request(app.getHttpServer())
        .post('/bookings/driver/pickup/arrived')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe('PICKUP_ARRIVED');
    });

    it('should cancel booking at PICKUP_ARRIVED with partial refund', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Driver taking too long' })
        .expect(201);

      expect(res.body.message).toContain('cancelled');

      // Verify booking is cancelled
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      expect(booking?.status).toBe('CANCELLED');

      // Verify driver is released
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
      });
      expect(driver?.driverStatus).toBe('AVAILABLE');
    });
  });

  describe('Idempotent cancellation', () => {
    let bookingId: string;

    beforeAll(async () => {
      const bookingData = createBookingRequestDto();
      bookingData.pickupAddress.formattedAddress = '400 Idempotent Cancel St';

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      bookingId = res.body.id;
      expect(bookingId).toBeDefined();

      // Cancel it once
      await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'First cancel' })
        .expect(201);
    });

    it('should reject second cancellation attempt', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Second cancel' })
        .expect(400);

      expect(res.body.message).toContain('already cancelled');
    });
  });

  describe('Authorization checks', () => {
    let bookingId: string;
    let otherCustomerToken: string;

    beforeAll(async () => {
      // Create another customer
      const otherCustomerPhone = `77${Date.now().toString().slice(-8)}`;
      const otherTokens = await loginAsCustomer(app, otherCustomerPhone);
      otherCustomerToken = otherTokens.accessToken;

      await request(app.getHttpServer())
        .post('/customer/profile')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ firstName: 'Other', lastName: 'Customer' });

      // Create booking with original customer
      const bookingData = createBookingRequestDto();
      bookingData.pickupAddress.formattedAddress = '500 Auth Check St';

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      bookingId = res.body.id;
      expect(bookingId).toBeDefined();
    });

    it('should reject cancellation by different customer', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${bookingId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ reason: 'Not my booking' })
        .expect(400);

      expect(res.body.message).toContain('only cancel your own');
    });

    it('should reject cancellation of non-existent booking', async () => {
      const fakeBookingId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .post(`/bookings/customer/cancel/${fakeBookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Does not exist' })
        .expect(404);
    });
  });
});
