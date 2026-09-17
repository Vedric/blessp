import Redis from 'ioredis';
import { Env } from '../config/env';
import { logger } from '../observability/logger';

let client: Redis | null = null;
let workerClient: Redis | null = null;

export function getRedisClient(worker = false): Redis | null {
  if (worker) {
    if (!Env.REDIS_URL) return null;
    if (!workerClient) {
      workerClient = new Redis(Env.REDIS_URL, { maxRetriesPerRequest: null, connectTimeout: 1000 });
      workerClient.on('error', () => logger.warn('Email worker Redis unavailable'));
    }
    return workerClient;
  }
  if (!Env.REDIS_URL) return null;

  if (!client) {
    client = new Redis(Env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: 500,
      connectTimeout: 500,
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
  workerClient?.disconnect();
  workerClient = null;
  if (client) {
    client.disconnect();
    client = null;
  }
}
