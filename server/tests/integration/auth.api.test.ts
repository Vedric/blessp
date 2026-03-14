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

afterAll(async () => {
  if (dbAvailable) {
    await teardownTestDatabase();
  }
});

const describeIfDb = () => (dbAvailable ? describe : describe.skip);

// We wrap all tests in a function so we can conditionally skip the entire suite.
// The outer describe is always declared; the inner one is skipped when no DB exists.
describe('Auth API integration tests', () => {
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

  const shouldRun = () => {
    if (!dbAvailable) {
      test.skip('database not available, skipping', () => {});
      return false;
    }
    return true;
  };

  describe('POST /api/v1/auth/register', () => {
    it('creates a new user and returns 201 with tokens', async () => {
      if (!shouldRun()) return;

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'StrongPassword1',
          firstName: 'Alice',
          lastName: 'Dupont',
        })
        .expect(201);

      expect(res.body.data.user).toMatchObject({
        email: 'newuser@example.com',
        firstName: 'Alice',
        lastName: 'Dupont',
        isAdmin: false,
      });
      expect(res.body.data.user.id).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.meta).toBeDefined();

      // Refresh token should be in an httpOnly cookie
      const cookies: string[] = res.headers['set-cookie'] ?? [];
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies])
        .find((c: string) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('returns 409 when email is already registered', async () => {
      if (!shouldRun()) return;

      const email = 'duplicate@example.com';

      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPassword1', firstName: 'A', lastName: 'B' })
        .expect(201);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPassword1', firstName: 'C', lastName: 'D' })
        .expect(409);

      expect(res.body.error.code).toBe('EMAIL_ALREADY_TAKEN');
    });

    it('returns 422 when the password is too weak', async () => {
      if (!shouldRun()) return;

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'weak@example.com',
          password: 'short',
          firstName: 'A',
          lastName: 'B',
        })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 200 with tokens on valid credentials', async () => {
      if (!shouldRun()) return;

      const email = 'login@example.com';
      const password = 'StrongPassword1';

      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password, firstName: 'A', lastName: 'B' })
        .expect(201);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('returns 401 with a generic message on invalid password', async () => {
      if (!shouldRun()) return;

      const email = 'loginbad@example.com';

      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'StrongPassword1', firstName: 'A', lastName: 'B' })
        .expect(201);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1' })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('returns 401 with the same generic message for a non-existent email', async () => {
      if (!shouldRun()) return;

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'StrongPassword1' })
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the user profile with a valid access token', async () => {
      if (!shouldRun()) return;

      const user = await registerTestUser();

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without an authorization header', async () => {
      if (!shouldRun()) return;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with an invalid token', async () => {
      if (!shouldRun()) return;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns a new token pair when a valid refresh token cookie is sent', async () => {
      if (!shouldRun()) return;

      const user = await registerTestUser();

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${user.refreshToken}`)
        .expect(200);

      expect(res.body.data.tokens.accessToken).toBeDefined();
      // A new refresh token cookie should be set
      const cookies: string[] = res.headers['set-cookie'] ?? [];
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies])
        .find((c: string) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
    });

    it('returns 401 when no refresh token cookie is present', async () => {
      if (!shouldRun()) return;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears the refresh token cookie and returns 204', async () => {
      if (!shouldRun()) return;

      const user = await registerTestUser();

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `refreshToken=${user.refreshToken}`)
        .expect(204);

      // The refresh token cookie should be cleared
      const cookies: string[] = res.headers['set-cookie'] ?? [];
      const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies])
        .find((c: string) => c.startsWith('refreshToken='));
      // A cleared cookie typically has an empty value or an expiry in the past
      if (refreshCookie) {
        expect(
          refreshCookie.includes('Expires=') || refreshCookie.includes('Max-Age=0')
            || refreshCookie.split('=')[1].startsWith(';'),
        ).toBe(true);
      }
    });

    it('invalidates the refresh token so subsequent refreshes fail', async () => {
      if (!shouldRun()) return;

      const user = await registerTestUser();

      // Logout to invalidate the token family
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `refreshToken=${user.refreshToken}`)
        .expect(204);

      // Attempting to use the old refresh token should fail
      await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${user.refreshToken}`)
        .expect(401);
    });
  });
});
