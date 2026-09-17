import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { Env } from '../../src/core/config/env';
import { securityHeaders } from '../../src/core/middleware/security.headers';

jest.mock('../../src/core/config/env', () => ({ Env: { NODE_ENV: 'test' } }));

describe('CSP and HTTPS enforcement', () => {
  it.each(['development', 'test', 'production'] as const)('serves appropriate transport policies in %s', async (environment) => {
    Env.NODE_ENV = environment;
    const app = express(); app.use(helmet(), securityHeaders);
    app.get('/', (_request, response) => response.send('local browser fixture'));
    const response = await request(app).get('/').expect(200);
    const csp = response.headers['content-security-policy'];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    if (environment === 'production') {
      expect(csp).toContain('upgrade-insecure-requests');
      expect(response.headers['strict-transport-security']).toContain('max-age=63072000');
    } else {
      expect(csp).not.toContain('upgrade-insecure-requests');
      expect(response.headers['strict-transport-security']).toBeUndefined();
    }
  });
});
