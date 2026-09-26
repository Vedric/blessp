import path from 'path';
import crypto from 'node:crypto';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Env } from './core/config/env';
import { requestId } from './core/middleware/request.id';
import { metricsMiddleware } from './core/middleware/metrics.middleware';
import { securityHeaders } from './core/middleware/security.headers';
import { globalRateLimiter } from './core/middleware/rate.limit';
import { globalErrorHandler } from './core/middleware/error.handler';
import { apiRouter } from './core/router/index';
import { prisma } from './core/database/client';
import { storefrontRouter } from './core/storefront/router';
import { register } from './core/observability/metrics';

export function createApp(): express.Application {
  const app = express();

  app.set('trust proxy', Env.TRUST_PROXY ? Env.TRUST_PROXY.split(',').map((s) => s.trim()) : false);

  app.use(requestId);
  // Core middleware
  app.use(helmet());

  const allowedOrigins = Env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy does not allow this origin.'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      credentials: true,
      maxAge: 86400,
    }),
  );

  app.use(cookieParser());

  // Stripe signature verification requires the untouched raw request buffer:
  // once express.json has consumed the stream, the route-level express.raw in
  // payments.router.ts never runs and constructEvent always rejects the
  // payload. The webhook path is therefore exempted from global JSON parsing.
  const jsonParser = express.json({ limit: '1mb' });
  app.use((req, res, next) => {
    if (req.path === '/api/v1/payments/webhook') {
      next();
    } else {
      jsonParser(req, res, next);
    }
  });

  app.use(metricsMiddleware);
  app.use(securityHeaders);

  // Prometheus metrics endpoint
  app.get('/metrics', async (req, res) => {
    const supplied = Buffer.from(req.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${Env.METRICS_TOKEN ?? ''}`);
    if (!Env.METRICS_TOKEN || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) { res.status(404).end(); return; }
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch {
      res.status(500).end();
    }
  });

  // Health check endpoints
  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'alive' });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ready',
        revision: process.env.APP_REVISION ?? 'development',
        checks: { database: 'fulfilled' },
      });
    } catch {
      res.status(503).json({
        status: 'unavailable',
        checks: { database: 'rejected' },
      });
    }
  });

  // API routes. The global limiter is scoped to the API prefix so that the
  // health probes and the Prometheus scrape endpoint above, which are polled
  // continuously by orchestrators and monitoring, are never throttled.
  app.use('/api/v1', globalRateLimiter, apiRouter);

  // Compress only public static responses; secrets in API responses stay uncompressed.
  // A 304 has no Content-Type, so compression's filter skips it. Preserve the
  // same cache variants as the original 200 response before that filter runs.
  app.use((_req, res, next) => { res.vary('Accept-Encoding'); next(); });
  app.use(compression());

  // Serve client static files in production
  const publicPath = process.env.STATIC_DIR ?? path.join(__dirname, '..', 'public');
  app.use(storefrontRouter(publicPath));
  app.use('/assets', express.static(path.join(publicPath, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(publicPath, { maxAge: '1h', setHeaders: (res, file) => { if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); } }));

  app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } }); });

  // Global error handler (must be registered last)
  app.use(globalErrorHandler);

  return app;
}
