import { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// In the test environment, bypass rate limiting entirely to prevent
// flaky integration tests caused by per-IP request limits.
const noopMiddleware: RequestHandler = (_req, _res, next) => next();

/**
 * General rate limiter for the entire API.
 * 100 requests per 15-minute window per IP.
 */
export const globalRateLimiter: RequestHandler = isTest
  ? noopMiddleware
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please wait before trying again.',
        },
      },
    });

/**
 * Strict rate limiter for authentication endpoints.
 * 10 requests per 15-minute window per IP.
 */
export const authRateLimiter: RequestHandler = isTest
  ? noopMiddleware
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts. Please wait before trying again.',
        },
      },
    });
