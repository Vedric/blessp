import Redis from 'ioredis';
import { logger } from '../observability/logger';

const KEY_PREFIX = 'blessp:';

export class CacheService {
  constructor(private readonly redis: Redis | null) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const raw = await this.redis.get(`${KEY_PREFIX}${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn({ err, key }, 'Cache get failed');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;

    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(`${KEY_PREFIX}${key}`, serialized, 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, 'Cache set failed');
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(`${KEY_PREFIX}${key}`);
    } catch (err) {
      logger.warn({ err, key }, 'Cache delete failed');
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    if (!this.redis) return;

    try {
      const fullPattern = `${KEY_PREFIX}${pattern}`;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.warn({ err, pattern }, 'Cache deleteByPattern failed');
    }
  }
}
