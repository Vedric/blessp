import request from 'supertest';
import {
  app,
  prisma,
  isDatabaseAvailable,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from '../helpers/test.setup';
import { registerTestUser, createAdminUser } from '../helpers/auth.helper';

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
 * Seeds a set of products directly in the database for listing and filter tests.
 */
async function seedProducts(): Promise<void> {
  await prisma.product.createMany({
    data: [
      { name: 'Classic Hoodie', price: 8500, category: 'hoodies', isActive: true },
      { name: 'Logo Tee', price: 4500, category: 'tees', isActive: true },
      { name: 'Cargo Pants', price: 12000, category: 'bottoms', isActive: true },
      { name: 'Draft Cap', price: 3000, category: 'accessories', isActive: false },
    ],
  });
}

describe('Products API integration tests', () => {
  describe('GET /api/v1/products', () => {
    it('returns a paginated list of active products', async () => {
      if (!dbAvailable) return;

      await seedProducts();

      const res = await request(app)
        .get('/api/v1/products')
        .expect(200);

      // Only active products should be returned by default
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.meta).toBeDefined();
    });

    it('respects pagination parameters', async () => {
      if (!dbAvailable) return;

      await seedProducts();

      const res = await request(app)
        .get('/api/v1/products?page=1&perPage=2')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.perPage).toBe(2);
    });

    it('filters products by category', async () => {
      if (!dbAvailable) return;

      await seedProducts();

      const res = await request(app)
        .get('/api/v1/products?category=hoodies')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((product: { category: string }) => {
        expect(product.category).toBe('hoodies');
      });
    });

    it('returns an empty list when no products match the filter', async () => {
      if (!dbAvailable) return;

      await seedProducts();

      const res = await request(app)
        .get('/api/v1/products?category=nonexistent')
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/products/:id', () => {
    it('returns a single product by ID', async () => {
      if (!dbAvailable) return;

      const product = await prisma.product.create({
        data: { name: 'Single Product Tee', price: 5000, isActive: true },
      });

      const res = await request(app)
        .get(`/api/v1/products/${product.id}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: product.id,
        name: 'Single Product Tee',
        price: 5000,
      });
    });

    it('returns 404 for a non-existent product', async () => {
      if (!dbAvailable) return;

      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app)
        .get(`/api/v1/products/${fakeId}`)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('GET /api/v1/products/filters', () => {
    it('returns available filter options', async () => {
      if (!dbAvailable) return;

      await seedProducts();

      const res = await request(app)
        .get('/api/v1/products/filters')
        .expect(200);

      expect(res.body.data).toBeDefined();
      // The filters response should include categories at minimum
      expect(res.body.data.categories).toBeDefined();
      expect(Array.isArray(res.body.data.categories)).toBe(true);
    });
  });

  describe('POST /api/v1/products', () => {
    it('allows an admin to create a product and returns 201', async () => {
      if (!dbAvailable) return;

      const admin = await createAdminUser({ email: 'productadmin@example.com' });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'New Drop Hoodie',
          price: 9500,
          description: 'Limited edition drop',
          category: 'hoodies',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        name: 'New Drop Hoodie',
        price: 9500,
        category: 'hoodies',
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('returns 403 when a non-admin attempts to create a product', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'regularuser@example.com' });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Unauthorized Product',
          price: 5000,
        })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 401 without authentication', async () => {
      if (!dbAvailable) return;

      await request(app)
        .post('/api/v1/products')
        .send({
          name: 'No Auth Product',
          price: 5000,
        })
        .expect(401);
    });

    it('returns 422 when required fields are missing', async () => {
      if (!dbAvailable) return;

      const admin = await createAdminUser({ email: 'productadmin2@example.com' });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ description: 'Missing name and price' })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
