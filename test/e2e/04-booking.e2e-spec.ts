import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app';
import { setupTestDatabase, closeDatabaseConnection, prisma } from '../setup/database';
import { loginAsCustomer, loginAsDriver } from '../setup/auth-helper';
import { testState } from '../setup/shared-state';
import { createBookingRequestDto } from '../factories';

/**
 * @doc test/docs/flows/04-booking.md
 */
describe('04 - Booking Flow (E2E)', () => {
  let app: INestApplication;
  let customerToken: string;
  let driverToken: string;
  let bookingId: string;
  let assignmentId: string;
  let driverId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();

    // Setup customer
    const customerPhone = `99${Date.now().toString().slice(-8)}`;
    const customerTokens = await loginAsCustomer(app, customerPhone);
    customerToken = customerTokens.accessToken;

    // Create customer profile
    await request(app.getHttpServer())
      .post('/customer/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ firstName: 'Test', lastName: 'Customer' });

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

    // Fetch driver profile to get the ID
    const driverProfile = await request(app.getHttpServer())
      .get('/driver/profile')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);

    driverId = driverProfile.body.id;
    testState.driverId = driverId;

    // Add vehicle
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

    // Set driver as verified and available via direct DB update
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

  describe('Estimates', () => {
    it('should calculate booking estimate', () => {
      const bookingData = createBookingRequestDto();

      return request(app.getHttpServer())
        .post('/bookings/customer/estimate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          pickupAddress: bookingData.pickupAddress,
          dropAddress: bookingData.dropAddress,
          packageDetails: bookingData.package,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.distanceKm).toBeGreaterThan(0);
          expect(res.body.topVehicles).toBeDefined();
          expect(res.body.topVehicles.length).toBeGreaterThan(0);
        });
    });

    it('should reject same pickup/drop address', () => {
      return request(app.getHttpServer())
        .post('/bookings/customer/estimate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          pickupAddress: {
            formattedAddress: 'Same address',
            latitude: 17.385,
            longitude: 78.486,
            contactName: 'Test',
            contactPhone: '9876543210',
          },
          dropAddress: {
            formattedAddress: 'Same address',
            latitude: 17.385,
            longitude: 78.486,
            contactName: 'Test',
            contactPhone: '9876543210',
          },
          packageDetails: {
            productType: 'PERSONAL',
            approximateWeight: 50,
            weightUnit: 'KG',
            personal: { productName: 'Test' },
          },
        })
        .expect(400);
    });
  });

  describe('Booking Creation', () => {
    it('should create booking', async () => {
      const bookingData = createBookingRequestDto();

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData)
        // POST may return 200 or 201 depending on controller decorator
        .expect((response) => {
          expect([200, 201]).toContain(response.status);
        });

      expect(res.body.status).toBe('PENDING');
      bookingId = res.body.id;
      testState.bookingId = bookingId;
    });

    it('should get booking details', () => {
      return request(app.getHttpServer())
        .get(`/bookings/customer/${bookingId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(bookingId);
          expect(res.body.status).toBe('PENDING');
        });
    });

    it('should get active bookings', () => {
      return request(app.getHttpServer())
        .get('/bookings/customer/active')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.some((b: any) => b.id === bookingId)).toBe(true);
        });
    });

    it('should get upload url', () => {
      return request(app.getHttpServer())
        .get('/bookings/customer/upload-url')
        .query({ filePath: 'bookings/item.jpg', type: 'image/jpeg' })
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.signedUrl).toBeDefined();
          expect(res.body.publicUrl).toBeDefined();
        });
    });
  });

  describe('Driver Assignment & Full Flow', () => {
    beforeAll(async () => {
      // Manually assign driver for testing using Prisma connect
      const assignment = await prisma.bookingAssignment.create({
        data: {
          booking: { connect: { id: bookingId } },
          driver: { connect: { id: driverId } },
          status: 'OFFERED',
        },
      });
      assignmentId = assignment.id;
      testState.assignmentId = assignmentId;

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'DRIVER_ASSIGNED',
          assignedDriverId: driverId,
        },
      });
    });

    it('should receive assignment update', async () => {
      // Driver should see the current assignment
      return request(app.getHttpServer())
        .get('/bookings/driver/current-assignment')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(assignmentId);
          expect(res.body.status).toBe('OFFERED');
        });
    });

    it('should accept assignment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/bookings/driver/accept/${assignmentId}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      // After accepting, booking should be CONFIRMED
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('CONFIRMED');
    });

    it('should arrive at pickup', async () => {
      // Driver endpoints use driverId from token, not bookingId in body
      const res = await request(app.getHttpServer())
        .post('/bookings/driver/pickup/arrived')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('PICKUP_ARRIVED');
    });

    it('should verify pickup', async () => {
      // Get booking OTP
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

      const res = await request(app.getHttpServer())
        .post('/bookings/driver/pickup/verify')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ otp: booking?.pickupOtp })
        .expect(201);

      const updatedBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(updatedBooking?.status).toBe('PICKUP_VERIFIED');
    });

    it('should start trip', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings/driver/start')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('IN_TRANSIT');
    });

    it('should arrive at drop', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings/driver/drop/arrived')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('DROP_ARRIVED');
    });

    it('should verify drop', async () => {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

      const res = await request(app.getHttpServer())
        .post('/bookings/driver/drop/verify')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ otp: booking?.dropOtp })
        .expect(201);

      const updatedBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(updatedBooking?.status).toBe('DROP_VERIFIED');
    });

    // Settle cash payment BEFORE finishing - finishRide requires payment to be completed
    it('should settle cash payment', async () => {
      return request(app.getHttpServer())
        .post('/bookings/driver/settle-cash')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);
    });

    it('should finish booking', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings/driver/finish')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(201);

      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(booking?.status).toBe('COMPLETED');
    });
  });

  describe('Online Payment Flow (Webhook)', () => {
    let onlineBookingId: string;
    let onlineAssignmentId: string;

    beforeAll(async () => {
      // Create a NEW booking for online payment test
      const bookingData = createBookingRequestDto();
      // Modify addresses slightly to create unique booking
      bookingData.pickupAddress.formattedAddress = '200 Pickup Online St, Hyderabad';
      bookingData.dropAddress.formattedAddress = '300 Drop Online Ave, Hyderabad';

      const res = await request(app.getHttpServer())
        .post('/bookings/customer')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData);

      onlineBookingId = res.body.id;

      // Assign driver
      const assignment = await prisma.bookingAssignment.create({
        data: {
          booking: { connect: { id: onlineBookingId } },
          driver: { connect: { id: driverId } },
          status: 'OFFERED',
        },
      });
      onlineAssignmentId = assignment.id;

      await prisma.booking.update({
        where: { id: onlineBookingId },
        data: {
          status: 'DRIVER_ASSIGNED',
          assignedDriverId: driverId,
        },
      });

      // Accept assignment
      await request(app.getHttpServer())
        .post(`/bookings/driver/accept/${onlineAssignmentId}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      // Progress through ride stages
      await request(app.getHttpServer())
        .post('/bookings/driver/pickup/arrived')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const bookingForPickup = await prisma.booking.findUnique({ where: { id: onlineBookingId } });
      await request(app.getHttpServer())
        .post('/bookings/driver/pickup/verify')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ otp: bookingForPickup?.pickupOtp })
        .expect(201);

      await request(app.getHttpServer())
        .post('/bookings/driver/start')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/bookings/driver/drop/arrived')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const bookingForDrop = await prisma.booking.findUnique({ where: { id: onlineBookingId } });
      await request(app.getHttpServer())
        .post('/bookings/driver/drop/verify')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ otp: bookingForDrop?.dropOtp })
        .expect(201);
    });

    it('should process Razorpay webhook for online payment', async () => {
      // Get the actual payment link ID from the invoice
      const invoice = await prisma.invoice.findFirst({
        where: { bookingId: onlineBookingId, type: 'FINAL' },
      });

      // Simulate Razorpay webhook for online payment
      const webhookPayload = {
        event: 'payment_link.paid',
        payload: {
          payment_link: {
            entity: {
              id: invoice?.rzpPaymentLinkId || 'plink_unknown',
              reference_id: invoice?.id || 'inv_unknown', // Use invoice ID as reference
            },
          },
          payment: {
            entity: {
              id: 'pay_test123',
            },
          },
        },
      };

      const res = await request(app.getHttpServer())
        .post('/bookings/webhook/razorpay')
        .set('x-razorpay-signature', 'test-signature')
        .send(webhookPayload)
        .expect(201);

      expect(res.body.status).toBe('ok');

      // Verify invoice is now marked as paid with ONLINE payment method
      const updatedInvoice = await prisma.invoice.findFirst({
        where: { bookingId: onlineBookingId, type: 'FINAL' },
      });
      expect(updatedInvoice?.isPaid).toBe(true);
      expect(updatedInvoice?.paymentMethod).toBe('ONLINE');
    });

    it('should finish booking after online payment', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings/driver/finish')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(201);

      const booking = await prisma.booking.findUnique({ where: { id: onlineBookingId } });
      expect(booking?.status).toBe('COMPLETED');
    });
  });

  describe('History', () => {
    it('should get customer booking history', () => {
      return request(app.getHttpServer())
        .get('/bookings/customer/history')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.some((b: any) => b.id === bookingId)).toBe(true);
        });
    });

    it('should get driver booking history', () => {
      return request(app.getHttpServer())
        .get('/bookings/driver/history')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Ride Summary', () => {
    it('should get ride summary for today (default)', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings/driver/ride-summary')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      // Should return today's date in YYYY-MM-DD format
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      expect(res.body.date).toBe(today);

      // Should have 2 completed rides (cash + online)
      expect(res.body.totalRides).toBeGreaterThanOrEqual(2);

      // Should include commission rate (e.g., 0.07 for 7%)
      expect(res.body.commissionRate).toBeDefined();
      expect(typeof res.body.commissionRate).toBe('number');

      // Should include net earnings (after commission deduction)
      expect(res.body.netEarnings).toBeDefined();
      expect(typeof res.body.netEarnings).toBe('number');
      expect(res.body.netEarnings).toBeGreaterThan(0);

      // Should include assignments array with full booking details
      expect(Array.isArray(res.body.assignments)).toBe(true);
      expect(res.body.assignments.length).toBe(res.body.totalRides);

      // Verify assignment structure
      const assignment = res.body.assignments[0];
      expect(assignment.booking).toBeDefined();
      expect(assignment.booking.package).toBeDefined();
      expect(assignment.booking.pickupAddress).toBeDefined();
      expect(assignment.booking.dropAddress).toBeDefined();
    });

    it('should get ride summary for specific date', async () => {
      // Use today's date explicitly
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const res = await request(app.getHttpServer())
        .get('/bookings/driver/ride-summary')
        .query({ date: today })
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.date).toBe(today);
      expect(res.body.totalRides).toBeGreaterThanOrEqual(2);
    });

    it('should return empty summary for future date', async () => {
      // Use a future date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureDateStr = futureDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const res = await request(app.getHttpServer())
        .get('/bookings/driver/ride-summary')
        .query({ date: futureDateStr })
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.date).toBe(futureDateStr);
      expect(res.body.totalRides).toBe(0);
      expect(res.body.netEarnings).toBe(0);
      expect(res.body.assignments).toEqual([]);
    });

    it('should verify commission calculation', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings/driver/ride-summary')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      if (res.body.totalRides > 0) {
        const assignment = res.body.assignments[0];
        const invoice = assignment.booking.invoices.find((inv: any) => inv.type === 'FINAL');

        if (invoice) {
          const totalAmount = Number(invoice.finalAmount);
          const commission = totalAmount * res.body.commissionRate;
          const expectedNetEarning = totalAmount - commission;

          // Net earnings should be less than total amount (commission deducted)
          expect(res.body.netEarnings).toBeLessThan(totalAmount * res.body.totalRides);
        }
      }
    });
  });
});
