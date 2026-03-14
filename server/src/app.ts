import path from 'path';
import express from 'express';
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
import { register } from './core/observability/metrics';

export function createApp(): express.Application {
  const app = express();

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
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(metricsMiddleware);
  app.use(securityHeaders);
  app.use(globalRateLimiter);

  // Prometheus metrics endpoint
  app.get('/metrics', async (_req, res) => {
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
        checks: { database: 'fulfilled' },
      });
    } catch {
      res.status(503).json({
        status: 'unavailable',
        checks: { database: 'rejected' },
      });
    }
  });

  // API routes
  app.use('/api/v1', apiRouter);

  // Serve client static files in production
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  // SPA catch-all: serve index.html for non-API routes so client-side routing works
  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api/') ||
      req.path.startsWith('/health/') ||
      req.path === '/metrics' ||
      req.path.includes('.')
    ) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // Global error handler (must be registered last)
  app.use(globalErrorHandler);

  return app;
}
