import request from 'supertest';
import { app, prisma } from './test.setup';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  accessToken: string;
  refreshToken: string;
}

let userCounter = 0;

/**
 * Registers a new test user via the API and returns the user data along
 * with valid access and refresh tokens.
 */
export async function registerTestUser(
  overrides: Partial<{ email: string; firstName: string; lastName: string; password: string }> = {},
): Promise<TestUser> {
  userCounter += 1;
  const email = overrides.email ?? `testuser${userCounter}_${Date.now()}@example.com`;
  const password = overrides.password ?? 'TestPassword1';

  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
    })
    .expect(201);

  // The refresh token is set as an httpOnly cookie
  const cookies: string[] = res.headers['set-cookie'] ?? [];
  const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies])
    .find((c: string) => c.startsWith('refreshToken='));

  const refreshToken = refreshCookie
    ? refreshCookie.split('=')[1].split(';')[0]
    : '';

  return {
    id: res.body.data.user.id,
    email: res.body.data.user.email,
    firstName: res.body.data.user.firstName,
    lastName: res.body.data.user.lastName,
    isAdmin: res.body.data.user.isAdmin,
    accessToken: res.body.data.tokens.accessToken,
    refreshToken,
  };
}

/**
 * Promotes an existing user to admin by updating the database directly.
 * Returns refreshed tokens via a new login.
 */
export async function createAdminUser(
  overrides: Partial<{ email: string; firstName: string; lastName: string; password: string }> = {},
): Promise<TestUser> {
  const password = overrides.password ?? 'AdminPassword1';
  const user = await registerTestUser({ ...overrides, password });

  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: true },
  });

  // Re-login to obtain tokens that include isAdmin: true in the JWT payload
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password })
    .expect(200);

  const cookies: string[] = loginRes.headers['set-cookie'] ?? [];
  const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies])
    .find((c: string) => c.startsWith('refreshToken='));

  const refreshToken = refreshCookie
    ? refreshCookie.split('=')[1].split(';')[0]
    : '';

  return {
    ...user,
    isAdmin: true,
    accessToken: loginRes.body.data.tokens.accessToken,
    refreshToken,
  };
}
