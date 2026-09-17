import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../database/client';
import { logger } from '../observability/logger';
import { emailService, type EmailPayload } from './email.service';

export async function enqueueEmail(tx: Prisma.TransactionClient, payload: EmailPayload, id: string = randomUUID()): Promise<void> {
  await tx.emailOutbox.upsert({ where: { id }, create: { id, payload: payload as unknown as Prisma.InputJsonValue }, update: {} });
}

/** A lease survives crashes; delivery is at least once (Resend also deduplicates by id). */
export async function drainEmailOutbox(): Promise<void> {
  const jobs = await prisma.$queryRaw<Array<{ id: string; payload: unknown; attempts: number }>>`
    UPDATE email_outbox SET available_at = NOW() + INTERVAL '2 minutes', attempts = attempts + 1
    WHERE id IN (SELECT id FROM email_outbox WHERE processed_at IS NULL AND available_at <= NOW()
      ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED)
    RETURNING id, payload, attempts`;
  for (const job of jobs) {
    try {
      await emailService.send({ ...(job.payload as EmailPayload), idempotencyKey: job.id });
      // Do not retain token-bearing email bodies after delivery.
      await prisma.emailOutbox.update({ where: { id: job.id }, data: { processedAt: new Date(), payload: {} } });
    } catch {
      await prisma.emailOutbox.update({ where: { id: job.id }, data: { availableAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(job.attempts, 12))) } });
      logger.error({ outboxId: job.id, attempts: job.attempts }, 'Email delivery failed; durable retry scheduled');
    }
  }
}
