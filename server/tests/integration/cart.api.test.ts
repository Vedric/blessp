import request from 'supertest';
import {
  app,
  prisma,
  isDatabaseAvailable,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from '../helpers/test.setup';
import { registerTestUser } from '../helpers/auth.helper';

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
 * Creates a product in the database that can be added to a cart.
 */
async function createTestProduct(overrides: Partial<{ name: string; price: number }> = {}) {
  return prisma.product.create({
    data: {
      name: overrides.name ?? 'Cart Test Tee',
      price: overrides.price ?? 4500,
      isActive: true,
    },
  });
}

describe('Cart API integration tests', () => {
  describe('POST /api/v1/cart', () => {
    it('adds a product to the cart and returns 201', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'cartadd@example.com' });
      const product = await createTestProduct();

      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ productId: product.id, quantity: 2 })
        .expect(201);

      expect(res.body.data).toBeDefined();
      // The response should contain the cart items
      const items = Array.isArray(res.body.data) ? res.body.data : res.body.data.items;
      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 when not authenticated', async () => {
      if (!dbAvailable) return;

      const product = await createTestProduct();

      await request(app)
        .post('/api/v1/cart')
        .send({ productId: product.id, quantity: 1 })
        .expect(401);
    });

    it('returns 422 when productId is invalid', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'cartbadid@example.com' });

      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ productId: 'not-a-uuid', quantity: 1 })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/cart', () => {
    it('returns the current cart for the authenticated user', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'cartget@example.com' });
      const product = await createTestProduct();

      // Add an item first
      await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ productId: product.id, quantity: 3 })
        .expect(201);

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('returns an empty cart when no items have been added', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'cartempty@example.com' });

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const items = Array.isArray(res.body.data) ? res.body.data : res.body.data.items;
      expect(items).toHaveLength(0);
    });

    it('returns 401 when not authenticated', async () => {
      if (!dbAvailable) return;

      await request(app)
        .get('/api/v1/cart')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/cart/:itemId', () => {
    it('updates the quantity of a cart item', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'cartpatch@example.com' });
      const product = await createTestProduct();

      // Add an item to get its cart item ID
      const addRes = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ productId: product.id, quantity: 1 })
        .expect(201);

      const items = Array.isArray(addRes.body.data) ? addRes.body.data : addRes.body.data.items;
      const cartItemId = items[0].id;

      const res = await request(app)
        .patch(`/api/v1/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ quantity: 5 })
        .expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('returns 401 when not authenticated', async () => {
      if (!dbAvailable) return;

      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app)
        .patch(`/api/v1/cart/${fakeId}`)
        .send({ quantity: 2 })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/cart/:itemId', () => {
    it('removes an item from the cart and returns 204', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'cartdelete@example.com' });
      const product = await createTestProduct();

      // Add an item
      const addRes = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ productId: product.id, quantity: 1 })
        .expect(201);

      const items = Array.isArray(addRes.body.data) ? addRes.body.data : addRes.body.data.items;
      const cartItemId = items[0].id;

      await request(app)
        .delete(`/api/v1/cart/${cartItemId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);

      // Verify the cart is now empty
      const getRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      const remaining = Array.isArray(getRes.body.data) ? getRes.body.data : getRes.body.data.items;
      expect(remaining).toHaveLength(0);
    });

    it('returns 401 when not authenticated', async () => {
      if (!dbAvailable) return;

      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app)
        .delete(`/api/v1/cart/${fakeId}`)
        .expect(401);
    });
  });
});
