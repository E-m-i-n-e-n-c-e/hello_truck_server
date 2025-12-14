import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app';
import { setupTestDatabase, closeDatabaseConnection, prisma } from '../setup/database';

/**
 * @doc test/docs/flows/08-admin.md
 */
describe('08 - Admin (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pendingDriverId: string;
  let reuploadDriverId: string;

  beforeAll(async () => {
    // Note: We use the same DB, so we rely on previous tests seeding drivers
    // If running isolated, we might need to seed a driver here.
    await setupTestDatabase();
    app = await createTestApp();

    // 1. Create a driver PENDING verification with documents
    const pendingDriver = await prisma.driver.create({
      data: {
        phoneNumber: `77${Date.now().toString().slice(-8)}`, // Unique phone
        verificationStatus: 'PENDING',
        documents: {
          create: {
            licenseUrl: 'http://example.com/license.jpg',
            rcBookUrl: 'http://example.com/rc.jpg',
            fcUrl: 'http://example.com/fc.jpg',
            insuranceUrl: 'http://example.com/ins.jpg',
            aadharUrl: 'http://example.com/aadhar.jpg',
            panNumber: `PAN${Date.now().toString().slice(-5)}`, // Unique PAN
            ebBillUrl: 'http://example.com/eb.jpg',
          },
        },
        walletBalance: 0,
      },
    });
    pendingDriverId = pendingDriver.id;

    // 2. Create a driver VERIFIED but with a PENDING document (e.g. License expired/reuploaded)
    const reuploadDriver = await prisma.driver.create({
      data: {
        phoneNumber: `66${Date.now().toString().slice(-8)}`,
        verificationStatus: 'VERIFIED',
        documents: {
          create: {
            licenseUrl: 'http://example.com/new-license.jpg',
            licenseStatus: 'PENDING', // This should trigger "pending docs"
            rcBookUrl: 'http://example.com/rc.jpg',
            fcUrl: 'http://example.com/fc.jpg',
            fcStatus: 'VERIFIED',
            insuranceUrl: 'http://example.com/ins.jpg',
            insuranceStatus: 'VERIFIED',
            aadharUrl: 'http://example.com/aadhar.jpg',
            panNumber: `PAN2${Date.now().toString().slice(-5)}`,
            ebBillUrl: 'http://example.com/eb.jpg',
          },
        },
        walletBalance: 0,
      },
    });
    reuploadDriverId = reuploadDriver.id;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabaseConnection();
  });

  describe('Auth', () => {
    it('should login as admin', () => {
      // Credentials set in jest-setup.ts
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin123';

      return request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ username, password })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          adminToken = res.body.accessToken;
        });
    });

    it('should fail login with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ username: 'wrong', password: 'bad' })
        .expect(401);
    });
  });

  describe('Flow 1: New Driver Verification', () => {
    it('should list pending drivers', () => {
      return request(app.getHttpServer())
        .get('/admin/drivers/pending-verification')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          const found = res.body.data.some((d: any) => d.id === pendingDriverId);
          expect(found).toBe(true);
          
          // Verify we get document data too
          const driver = res.body.data.find((d: any) => d.id === pendingDriverId);
          expect(driver.documents).toBeDefined();
          expect(driver.documents.licenseUrl).toBe('http://example.com/license.jpg');
        });
    });

    it('should verify driver and set expiry dates', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await request(app.getHttpServer())
        .patch(`/admin/drivers/${pendingDriverId}/verification`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'VERIFIED',
          licenseExpiry: futureDate.toISOString(),
          fcExpiry: futureDate.toISOString(),
          insuranceExpiry: futureDate.toISOString(),
        })
        .expect(200);

      // Verify DB updates directly to be sure
      const updatedDriver = await prisma.driver.findUnique({
        where: { id: pendingDriverId },
        include: { documents: true },
      });

      expect(updatedDriver?.verificationStatus).toBe('VERIFIED');
      expect(updatedDriver?.documents?.licenseStatus).toBe('VERIFIED');
      expect(updatedDriver?.documents?.licenseExpiry).toEqual(futureDate);
    });

    it('should no longer appear in pending verification list', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/drivers/pending-verification')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const found = res.body.data.some((d: any) => d.id === pendingDriverId);
      expect(found).toBe(false);
    });
  });

  describe('Flow 2: Pending Documents (Re-upload)', () => {
    it('should list drivers with pending documents', () => {
      return request(app.getHttpServer())
        .get('/admin/drivers/pending-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          const found = res.body.data.some((d: any) => d.id === reuploadDriverId);
          expect(found).toBe(true);
        });
    });

    it('should verify the pending document and update expiry', async () => {
      const newExpiry = new Date();
      newExpiry.setFullYear(newExpiry.getFullYear() + 2); // 2 years later

      await request(app.getHttpServer())
        .patch(`/admin/drivers/${reuploadDriverId}/verification`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'VERIFIED', // Keeping driver Verified
          licenseExpiry: newExpiry.toISOString(),
          // Not sending others implies they remain unchanged or handled by service logic
        })
        .expect(200);

      const updatedDriver = await prisma.driver.findUnique({
        where: { id: reuploadDriverId },
        include: { documents: true },
      });
      
      expect(updatedDriver?.documents?.licenseStatus).toBe('VERIFIED');
      expect(updatedDriver?.documents?.licenseExpiry).toEqual(newExpiry);
    });
    
    it('should no longer appear in pending documents list', async () => {
       const res = await request(app.getHttpServer())
        .get('/admin/drivers/pending-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.some((d: any) => d.id === reuploadDriverId);
      expect(found).toBe(false);
    });
  });
});
