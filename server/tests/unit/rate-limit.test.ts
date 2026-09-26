import express, { type RequestHandler } from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import { TokenService } from '../../src/core/security/token.service';

function protectedApp() {
  let limiter!: RequestHandler;
  const previous = process.env.NODE_ENV;
  try {
    // Exercise the real limiter: normal integration suites deliberately bypass it.
    process.env.NODE_ENV = 'development';
    jest.isolateModules(() => { limiter = require('../../src/core/middleware/rate.limit').authRateLimiter; });
  } finally { process.env.NODE_ENV = previous; }
  const app = express();
  app.get('/health/live', (_req, res) => res.sendStatus(200));
  app.get('/protected', limiter, (_req, res) => res.sendStatus(200));
  return app;
}

it('bounds a concurrent anonymous burst and leaves health checks available', async () => {
  const app = protectedApp();
  const results = await Promise.all(Array.from({ length: 25 }, () => request(app).get('/protected')));
  expect(results.filter(r => r.status === 200)).toHaveLength(10);
  expect(results.filter(r => r.status === 429)).toHaveLength(15);
  const limited = results.find(r => r.status === 429)!;
  expect(limited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  await request(app).get('/health/live').expect(200);
});

it('forged subjects and forwarded addresses cannot reset the anonymous quota', async () => {
  const app = protectedApp();
  for (let i = 0; i < 12; i++) {
    const forged = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ userId: crypto.randomUUID() })).toString('base64url')}.`;
    await request(app).get('/protected').set('Authorization', `Bearer ${forged}`).set('X-Forwarded-For', `192.0.2.${i + 1}`).expect(i < 10 ? 200 : 429);
  }
});

it('verified customers behind one address have independent quotas', async () => {
  const app = protectedApp(); const tokens = new TokenService();
  const first = tokens.signAccessToken({ userId: crypto.randomUUID(), email: 'first@example.com', isAdmin: false });
  const second = tokens.signAccessToken({ userId: crypto.randomUUID(), email: 'second@example.com', isAdmin: false });
  for (let i = 0; i < 10; i++) await request(app).get('/protected').set('Authorization', `Bearer ${first}`).expect(200);
  await request(app).get('/protected').set('Authorization', `Bearer ${first}`).expect(429);
  await request(app).get('/protected').set('Authorization', `Bearer ${second}`).expect(200);
  await request(app).get('/protected').expect(200);
});
