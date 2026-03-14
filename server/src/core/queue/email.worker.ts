import { Worker, Job, type ConnectionOptions } from 'bullmq';
import { getRedisClient } from '../cache/redis.client';
import { sendOrderConfirmation } from '../../features/orders/order.emails';
import { logger } from '../observability/logger';
import type { OrderConfirmationJobData } from './email.producer';

let emailWorker: Worker | null = null;

export function startEmailWorker(): void {
  const redis = getRedisClient();
  if (!redis) {
    logger.info('Redis not configured, skipping email worker startup');
    return;
  }

  emailWorker = new Worker<OrderConfirmationJobData>(
    'email',
    async (job: Job<OrderConfirmationJobData>) => {
      logger.info(
        { jobId: job.id, orderId: job.data.orderId },
        'Processing order confirmation email job',
      );
      await sendOrderConfirmation(job.data);
    },
    {
      connection: redis as unknown as ConnectionOptions,
      concurrency: 5,
    },
  );

  emailWorker.on('completed', (job: Job<OrderConfirmationJobData>) => {
    logger.info(
      { jobId: job.id, orderId: job.data.orderId },
      'Order confirmation email sent successfully',
    );
  });

  emailWorker.on('failed', (job: Job<OrderConfirmationJobData> | undefined, err: Error) => {
    logger.error(
      { err, jobId: job?.id, orderId: job?.data?.orderId },
      'Order confirmation email job failed',
    );
  });

  logger.info('BullMQ email worker started');
}

export async function stopEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
    logger.info('BullMQ email worker stopped');
  }
}
