import { encryptSecret } from './security/secrets';
import { emailOutboxPending, emailOutboxOldestSeconds } from './observability/metrics';
import { prisma } from './database/client';
import { transaction, lockResource } from './database/transaction';
import { drainEmailOutbox } from './email/outbox';
import { logger } from './observability/logger';
import { PaymentsService } from '../features/payments/payments.service';
import { OrdersRepository } from '../features/orders/orders.repository';

export async function purgeDeletedAccounts(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const users = await prisma.user.findMany({ where: { deletedAt: { lte: cutoff }, NOT: { email: { endsWith: '@deleted.invalid' } } }, select: { id: true, email: true }, take: 25 });
  for (const user of users) await transaction(async (tx) => {
    await lockResource(tx, `session:${user.id}`);
    await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.oAuthAccount.deleteMany({ where: { userId: user.id } });
    await tx.mfaSetup.deleteMany({ where: { userId: user.id } });
    await tx.address.deleteMany({ where: { userId: user.id } });
    await tx.cartItem.deleteMany({ where: { userId: user.id } });
    await tx.wishlistItem.deleteMany({ where: { userId: user.id } });
    await tx.review.deleteMany({ where: { userId: user.id } });
    await tx.emailPreference.deleteMany({ where: { userId: user.id } });
    await tx.newsletterSubscription.deleteMany({ where: { email: user.email } });
    const contacts = await tx.contactMessage.findMany({ where: { email: user.email }, select: { id: true } });
    await tx.emailOutbox.deleteMany({ where: { id: { in: contacts.map(contact => `contact:${contact.id}`) } } });
    await tx.contactMessage.deleteMany({ where: { email: user.email } });
    await tx.emailOutbox.deleteMany({ where: { payload: { path: ['to'], equals: user.email } } });
    await tx.coupon.updateMany({ where: { userId: user.id }, data: { isActive: false } });
    await tx.user.update({ where: { id: user.id }, data: { email: `${user.id}@deleted.invalid`, firstName: 'Deleted', lastName: 'Account', passwordHash: null, isAdmin: false, emailVerifiedAt: null, sessionVersion: { increment: 1 } } });
    logger.info({ userId: user.id }, 'Account anonymized after retention window; financial records retained');
  });
}

export function startMaintenance(): () => Promise<void> {
  let running: Promise<void> | null = null;
  const payments = new PaymentsService(new OrdersRepository());
  const tick = () => {
    if (running) return;
    running = (async () => {
      // Retain development mail for explicit local inspection when no provider is configured.
      if (process.env.RESEND_API_KEY || process.env.POSTMARK_API_KEY) await drainEmailOutbox();
      const legacyFactors = await prisma.mfaSetup.findMany({ where: { NOT: { secret: { startsWith: 'v1:' } }, secret: { not: '' } }, take: 100 });
      for (const factor of legacyFactors) await prisma.mfaSetup.updateMany({ where: { userId: factor.userId, secret: factor.secret }, data: { secret: encryptSecret(factor.secret) } });
      const pending = await prisma.emailOutbox.aggregate({ where: { processedAt: null }, _count: true, _min: { createdAt: true } });
      emailOutboxPending.set(pending._count);
      emailOutboxOldestSeconds.set(pending._min.createdAt ? (Date.now() - pending._min.createdAt.getTime()) / 1000 : 0);
      await payments.expireReservations();
      await purgeDeletedAccounts();
    })().catch(() => logger.error('Maintenance failed; retry scheduled')).finally(() => { running = null; });
  };
  const timer = setInterval(tick, 10000);
  timer.unref();
  tick();
  return async () => { clearInterval(timer); await running; };
}
