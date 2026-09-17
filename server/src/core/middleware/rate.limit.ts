import { type Request, type RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator, type Logger } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { getRedisClient } from '../cache/redis.client';
import { TokenService } from '../security/token.service';
import { logger } from '../observability/logger';

const isTest = process.env.NODE_ENV === 'test';

// In the test environment, bypass rate limiting entirely to prevent
// flaky integration tests caused by per-IP request limits.
const noopMiddleware: RequestHandler = (_req, _res, next) => next();

const tokenService = new TokenService();

/**
 * Builds a Redis-backed store for a limiter so counters are shared across
 * instances and survive restarts. Returns undefined when Redis is not
 * configured, in which case express-rate-limit falls back to its in-memory
 * store (acceptable for local development, never for production).
 *
 * Each limiter needs its own store instance with a distinct prefix so their
 * counters never collide in a shared Redis.
 */
function createRedisStore(prefix: string): RedisStore | undefined {
  const client = getRedisClient();
  if (!client) return undefined;

  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]): Promise<RedisReply> => {
      // ioredis enforces its own bounded command timeout and disables offline queuing.
      return client.call(args[0], ...args.slice(1)) as Promise<RedisReply>;
    },
  });
}

/**
 * Keys authenticated traffic by the JWT subject so clients behind a shared IP
 * (corporate NAT, mobile carriers) do not exhaust each other's quota. We fully
 * verify the token rather than merely decoding it: RS256 verification against
 * the local public key costs well under a millisecond per request, while an
 * unverified claim would let anyone mint arbitrary keys and sidestep per-client
 * limits. Invalid or expired tokens fall back to the client IP, aggregated by
 * /56 for IPv6 so a single subscriber cannot rotate through a whole prefix.
 */
function clientKeyGenerator(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = tokenService.verifyAccessToken(authHeader.slice(7));
      return `user:${payload.userId}`;
    } catch {
      // Malformed or expired token: treat the request as anonymous traffic.
    }
  }
  return ipKeyGenerator(req.ip ?? 'unknown', 56);
}

// A Redis outage is degraded-but-expected behaviour (limiters fail open), so
// store errors are logged at warn level rather than error to avoid paging on
// every blip while still leaving a trail for sustained-rate alerting.
const limiterLogger: Logger = {
  error: (error: unknown, message?: string) => {
    logger.warn({ err: error }, message ?? 'Rate limiter store error, failing open');
  },
  warn: (error: unknown, message?: string) => {
    logger.warn({ err: error }, message ?? 'Rate limiter warning');
  },
};

interface LimiterConfig {
  windowMs: number;
  limit: number;
  storePrefix: string;
  message: string;
}

function createLimiter(config: LimiterConfig): RequestHandler {
  const options = {
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKeyGenerator,
    logger: limiterLogger,
    message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: config.message } },
  };
  // A local quota remains active during Redis outages. Shared quotas add
  // cross-instance protection while Redis is ready; they never queue requests.
  const local = rateLimit(options);
  const store = createRedisStore(config.storePrefix);
  if (!store) return local;
  const shared = rateLimit({ ...options, store, passOnStoreError: true });
  return (req, res, next) => local(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (getRedisClient()?.status !== 'ready') return next();
    return shared(req, res, next);
  });
}

/**
 * General rate limiter for the API (mounted on /api/v1 only, so health checks
 * and the metrics endpoint are never throttled).
 * 600 requests per 15-minute window per client (JWT subject or IP).
 */
export const globalRateLimiter: RequestHandler = isTest
  ? noopMiddleware
  : createLimiter({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      storePrefix: 'blessp-api:rl:global:',
      message: 'Too many requests. Please wait before trying again.',
    });

/**
 * Strict rate limiter for authentication endpoints.
 * 10 requests per 15-minute window per client.
 */
export const authRateLimiter: RequestHandler = isTest
  ? noopMiddleware
  : createLimiter({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      storePrefix: 'blessp-api:rl:auth:',
      message: 'Too many authentication attempts. Please wait before trying again.',
    });

/**
 * Rate limiter for the Stripe webhook endpoint.
 * Stripe can burst event deliveries but should not reach thousands per
 * second from a single source. 300 requests per minute per IP leaves
 * comfortable headroom for retries while rejecting floods.
 */
export const webhookRateLimiter: RequestHandler = isTest
  ? noopMiddleware
  : createLimiter({
      windowMs: 60 * 1000,
      limit: 300,
      storePrefix: 'blessp-api:rl:webhook:',
      message: 'Too many webhook requests. Please wait before trying again.',
    });
