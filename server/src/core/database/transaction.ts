import { Prisma } from '@prisma/client';
import { prisma } from './client';

/** Locks a business resource across processes, for the lifetime of this transaction. */
export async function lockResource(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}

export async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, timeout = 15000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { maxWait: 5000, timeout });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) throw error;
    }
  }
}
