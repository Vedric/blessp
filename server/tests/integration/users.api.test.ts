import request from 'supertest';
import {
  app,
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

describe('Users API integration tests', () => {
  describe('GET /api/v1/users/profile', () => {
    it('returns the authenticated user profile', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({
        email: 'profile@example.com',
        firstName: 'Alice',
        lastName: 'Martin',
      });

      const res = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: user.id,
        email: 'profile@example.com',
        firstName: 'Alice',
        lastName: 'Martin',
      });
      expect(res.body.data).not.toHaveProperty('passwordHash');
      expect(res.body.meta).toBeDefined();
    });

    it('returns 401 without authentication', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with an invalid token', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/v1/users/profile', () => {
    it('updates the user first name and last name', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'updateprofile@example.com' });

      const res = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ firstName: 'Updated', lastName: 'Name' })
        .expect(200);

      expect(res.body.data.firstName).toBe('Updated');
      expect(res.body.data.lastName).toBe('Name');
    });

    it('allows partial updates (only firstName)', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({
        email: 'partialupdate@example.com',
        firstName: 'Original',
        lastName: 'Last',
      });

      const res = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ firstName: 'Changed' })
        .expect(200);

      expect(res.body.data.firstName).toBe('Changed');
      expect(res.body.data.lastName).toBe('Last');
    });

    it('returns 401 without authentication', async () => {
      if (!dbAvailable) return;

      await request(app)
        .patch('/api/v1/users/profile')
        .send({ firstName: 'Nope' })
        .expect(401);
    });
  });

  describe('GET /api/v1/users/email-preferences', () => {
    it('returns the email preferences for the authenticated user', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'emailprefs@example.com' });

      const res = await request(app)
        .get('/api/v1/users/email-preferences')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      // Email preferences should contain boolean fields
      expect(typeof res.body.data.orderUpdates).toBe('boolean');
      expect(typeof res.body.data.promotions).toBe('boolean');
      expect(typeof res.body.data.newsletter).toBe('boolean');
    });

    it('returns 401 without authentication', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .get('/api/v1/users/email-preferences')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/v1/users/email-preferences', () => {
    it('updates email preferences and returns the updated values', async () => {
      if (!dbAvailable) return;

      const user = await registerTestUser({ email: 'updateprefs@example.com' });

      const res = await request(app)
        .patch('/api/v1/users/email-preferences')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ promotions: false, newsletter: true })
        .expect(200);

      expect(res.body.data.promotions).toBe(false);
      expect(res.body.data.newsletter).toBe(true);
    });

    it('returns 401 without authentication', async () => {
      if (!dbAvailable) return;

      await request(app)
        .patch('/api/v1/users/email-preferences')
        .send({ promotions: false })
        .expect(401);
    });
  });
});
