import request from 'supertest';
import {
  app,
  prisma,
  isDatabaseAvailable,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from '../helpers/test.setup';
import { registerTestUser, createAdminUser, TestUser } from '../helpers/auth.helper';

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (dbAvailable) {
    await setupTestDatabase();
  }
});

afterEach(async () => {
  if (dbAvailable) {
    await cleanDatabase();
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await teardownTestDatabase();
  }
});

/**
 * Creates a product directly in the database, adds it to the user's cart,
 * and creates an order from the cart via the API.
 */
async function seedProductAndCart(user: TestUser): Promise<{
  product: { id: string; name: string; price: number };
  orderId: string;
}> {
  const product = await prisma.product.create({
    data: {
      name: 'Integration Test Tee',
      price: 4500,
      description: 'A test product for integration tests',
      isActive: true,
    },
  });

  // Add product to cart via the API
  await request(app)
    .post('/api/v1/cart')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({ productId: product.id, quantity: 2 })
    .expect(201);

  // Create order from cart
  const orderRes = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .send({
      firstName: 'Alice',
      lastName: 'Dupont',
      phone: '+33612345678',
      addressLine1: '12 Rue de Paris',
      city: 'Paris',
      postalCode: '75001',
      country: 'FR',
    })
    .expect(201);

  return {
    product: { id: product.id, name: product.name, price: product.price },
    orderId: orderRes.body.data.id,
  };
}

describe('Orders API integration tests', () => {
  describe('POST /api/v1/orders', () => {
    it('creates an order from the cart and returns 201', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser();

      const product = await prisma.product.create({
        data: {
          name: 'Order Test Tee',
          price: 3000,
          isActive: true,
        },
      });

      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ productId: product.id, quantity: 1 })
        .expect(201);

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          firstName: 'Alice',
          lastName: 'Dupont',
          addressLine1: '10 Rue Bleue',
          city: 'Lyon',
          postalCode: '69001',
          country: 'FR',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        userId: user.id,
        status: 'pending',
        totalCents: 3000,
      });
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productName).toBe('Order Test Tee');
    });

    it('returns 422 when the cart is empty', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser();

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          firstName: 'A',
          lastName: 'B',
          addressLine1: '1 Street',
          city: 'City',
          postalCode: '00000',
          country: 'US',
        })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 without authentication', async () => {
      if (!dbAvailable) return;

      await request(app)
        .post('/api/v1/orders')
        .send({
          firstName: 'A',
          lastName: 'B',
          addressLine1: '1 Street',
          city: 'City',
          postalCode: '00000',
          country: 'US',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/orders/mine', () => {
    it('returns the authenticated user orders', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser();
      await seedProductAndCart(user);

      const res = await request(app)
        .get('/api/v1/orders/mine')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].userId).toBe(user.id);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalItems).toBe(1);
    });

    it('returns an empty list when the user has no orders', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser();

      const res = await request(app)
        .get('/api/v1/orders/mine')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.totalItems).toBe(0);
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('returns order details when the requester is the owner', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser();
      const { orderId } = await seedProductAndCart(user);

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(orderId);
      expect(res.body.data.userId).toBe(user.id);
      expect(res.body.data.items).toBeDefined();
    });

    it('returns 403 when a non-owner, non-admin user requests the order', async () => {
      if (!dbAvailable) return;

      const owner = await registerTestUser({ email: 'owner@example.com' });
      const other = await registerTestUser({ email: 'other@example.com' });
      const { orderId } = await seedProductAndCart(owner);

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${other.accessToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows an admin to view any order', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'regular@example.com' });
      const admin = await createAdminUser({ email: 'admin@example.com' });
      const { orderId } = await seedProductAndCart(user);

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(orderId);
    });

    it('returns 404 for a non-existent order', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .get(`/api/v1/orders/${fakeId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/orders/:id/status', () => {
    it('allows an admin to update order status', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'buyer@example.com' });
      const admin = await createAdminUser({ email: 'statusadmin@example.com' });
      const { orderId } = await seedProductAndCart(user);

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ status: 'confirmed' })
        .expect(200);

      expect(res.body.data.status).toBe('confirmed');
    });

    it('returns 403 when a non-admin attempts to update status', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser();
      const { orderId } = await seedProductAndCart(user);

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: 'confirmed' })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 422 for an invalid status value', async () => {
      if (!dbAvailable) return;

      const admin = await createAdminUser({ email: 'badstatus@example.com' });
      const user = await registerTestUser({ email: 'buyer2@example.com' });
      const { orderId } = await seedProductAndCart(user);

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ status: 'nonexistent_status' })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
