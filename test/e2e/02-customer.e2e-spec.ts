import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app';
import { setupTestDatabase, closeDatabaseConnection } from '../setup/database';
import { loginAsCustomer } from '../setup/auth-helper';
import { testState } from '../setup/shared-state';

/**
 * @doc test/docs/flows/02-customer.md
 */
describe('02 - Customer Profile (E2E)', () => {
  let app: INestApplication;
  let customerToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
    
    // Login as customer (creates Customer with phoneNumber only)
    const customerPhone = `99${Date.now().toString().slice(-8)}`;
    const tokens = await loginAsCustomer(app, customerPhone);
    customerToken = tokens.accessToken;
    testState.customerPhone = customerPhone;
    testState.customerToken = customerToken;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabaseConnection();
  });

  describe('Profile', () => {
    it('should return profile with null firstName before profile is created', () => {
      return request(app.getHttpServer())
        .get('/customer/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          // Customer exists from OTP verification, but firstName is null
          expect(res.body.firstName).toBeNull();
        });
    });

    it('should create customer profile', () => {
      return request(app.getHttpServer())
        .post('/customer/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          firstName: 'Test',
          lastName: 'Customer',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should get customer profile', () => {
      return request(app.getHttpServer())
        .get('/customer/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.firstName).toBe('Test');
          expect(res.body.lastName).toBe('Customer');
        });
    });

    it('should update customer profile', () => {
      return request(app.getHttpServer())
        .put('/customer/profile')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          firstName: 'Updated',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('Saved Addresses', () => {
    let addressId: string;

    it('should create address', () => {
      return request(app.getHttpServer())
        .post('/customer/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Home',
          contactName: 'John Doe',
          contactPhone: '+919876543210',
          address: {
            formattedAddress: '123 Main St, Hyderabad',
            latitude: 17.385,
            longitude: 78.486,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Home');
          addressId = res.body.id;
          testState.addressId = addressId;
        });
    });

    it('should get all addresses', () => {
      return request(app.getHttpServer())
        .get('/customer/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });

    it('should create default address', () => {
      return request(app.getHttpServer())
        .post('/customer/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Office',
          contactName: 'Jane Doe',
          contactPhone: '+919876543211',
          isDefault: true,
          address: {
            formattedAddress: '456 Office Blvd, Hyderabad',
            latitude: 17.45,
            longitude: 78.52,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.isDefault).toBe(true);
        });
    });

    it('should update address', () => {
      return request(app.getHttpServer())
        .put(`/customer/addresses/${testState.addressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Home Updated',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Home Updated');
        });
    });

    it('should delete address', () => {
      return request(app.getHttpServer())
        .delete(`/customer/addresses/${testState.addressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
    });
  });

  describe('GST Details', () => {
    it('should add GST details', async () => {
      await request(app.getHttpServer())
        .post('/customer/gst')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          gstNumber: '29ABCDE1234F1Z5',
          businessName: 'Test Company',
          businessAddress: '123 Business St, Hyderabad',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });

      // Get the GST ID from the list
      const listRes = await request(app.getHttpServer())
        .get('/customer/gst')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      
      expect(listRes.body.length).toBeGreaterThan(0);
      testState.gstId = listRes.body[0].id;
    });

    it('should get all GST details', () => {
      return request(app.getHttpServer())
        .get('/customer/gst')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].gstNumber).toBe('29ABCDE1234F1Z5');
        });
    });

    it('should update GST details', () => {
      return request(app.getHttpServer())
        .put(`/customer/gst/${testState.gstId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          businessName: 'Updated Company',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });
});
