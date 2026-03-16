// Environment variables must be configured before importing any application modules.
import './setup.env';

import { createApp } from '../../src/app';
import { prisma, disconnectPrisma } from '../../src/core/database/client';

export const app = createApp();

/**
 * Returns true when a real PostgreSQL database is reachable.
 * Used to skip integration tests gracefully when no database is available.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Pushes the Prisma schema to the test database so all tables exist.
 * This is idempotent and safe to call multiple times.
 */
export async function setupTestDatabase(): Promise<void> {
  // Tables are expected to exist already (via prisma db push or migrate in CI).
  // We simply verify the connection here.
  await prisma.$queryRaw`SELECT 1`;
}

/**
 * Removes all rows from the tables used in integration tests.
 * Deletion order respects foreign key constraints.
 */
export async function cleanDatabase(): Promise<void> {
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
