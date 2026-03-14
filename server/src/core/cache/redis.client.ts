import Redis from 'ioredis';
import { Env } from '../config/env';
import { logger } from '../observability/logger';

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!Env.REDIS_URL) return null;

  if (!client) {
    client = new Redis(Env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      lazyConnect: true,
    });

    client.on('error', (err) => {
      logger.warn({ err }, 'Redis connection error');
    });

    client.on('connect', () => {
      logger.info('Redis connection established');
    });

    client.connect().catch((err) => {
      logger.warn({ err }, 'Redis initial connection failed, cache will operate in no-op mode');
    });
  }

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
