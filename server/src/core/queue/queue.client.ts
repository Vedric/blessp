import { Queue, type ConnectionOptions } from 'bullmq';
import { getRedisClient } from '../cache/redis.client';
import { logger } from '../observability/logger';

let emailQueue: Queue | null = null;

export function getEmailQueue(): Queue | null {
  const redis = getRedisClient();
  if (!redis) return null;

  if (!emailQueue) {
    emailQueue = new Queue('email', {
      connection: redis as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    logger.info('BullMQ email queue initialized');
  }

  return emailQueue;
}

export async function closeQueues(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
}
