// Environment variables must be configured before importing any application modules.
import './setup.env';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createApp } from '../../src/app';
import { prisma, disconnectPrisma } from '../../src/core/database/client';

export const app = createApp();

/**
 * Returns true when a real PostgreSQL database is reachable.
 * Fails the suite when PostgreSQL is unavailable; never silently skips.
 */
function assertTestDatabase(): void {
  const url = new URL(process.env.DATABASE_URL!);
  if (process.env.NODE_ENV !== 'test' || !/_(test|audit|ci)$/.test(url.pathname) || !/^test_\d+$/.test(url.searchParams.get('schema') ?? '')) throw new Error('Refusing to mutate a database without an explicit test name and worker schema.');
}

export async function isDatabaseAvailable(): Promise<boolean> {
  assertTestDatabase();
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

/**
 * Applies the real migration chain to each isolated worker schema.
 * This is idempotent and safe to call multiple times.
 */
export async function setupTestDatabase(): Promise<void> {
  assertTestDatabase();
  await promisify(execFile)(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: process.cwd(), env: process.env });
}

/**
 * Removes all rows from the tables used in integration tests.
 * Deletion order respects foreign key constraints.
 */
export async function cleanDatabase(): Promise<void> {
  assertTestDatabase();
  await prisma.stockAdjustment.deleteMany();
  await prisma.emailOutbox.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.stripeWebhookEvent.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.address.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.newsletterSubscription.deleteMany();
  await prisma.user.deleteMany();
}

export async function teardownTestDatabase(): Promise<void> {
  await cleanDatabase();
  await disconnectPrisma();
}

export { prisma };
