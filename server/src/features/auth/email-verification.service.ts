import crypto from 'node:crypto';
import { prisma } from '../../core/database/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { hashToken } from '../../core/security/secrets';
import { UnauthorizedError } from '../../core/errors/http.errors';
import { enqueueEmail } from '../../core/email/outbox';
import { verificationEmailPayload, welcomeEmailPayload, emailChangedPayload, type AccountLocale } from './auth.emails';

export class EmailVerificationService {
  async request(userId: string, email: string, locale: AccountLocale = 'en'): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await transaction(async (tx) => {
      await lockResource(tx, `session:${userId}`);
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.create({ data: { userId, email, locale, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) } });
      await enqueueEmail(tx, verificationEmailPayload({ email, token, locale }));
    });
  }

  async resend(email: string, locale: AccountLocale = 'en'): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
    if (user && !user.emailVerifiedAt) await this.request(user.id, user.email, locale);
  }

  async confirm(token: string): Promise<void> {
    await transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!verification || verification.expiresAt <= new Date()) throw new UnauthorizedError('Invalid or expired verification link.');
      await lockResource(tx, `session:${verification.userId}`);
      const consumed = await tx.emailVerificationToken.deleteMany({ where: { id: verification.id } });
      if (consumed.count !== 1) throw new UnauthorizedError('Verification link already used.');
      const user = await tx.user.findUniqueOrThrow({ where: { id: verification.userId, deletedAt: null } });
      const locale = verification.locale === 'fr' ? 'fr' : 'en';
      await tx.user.update({ where: { id: user.id }, data: { email: verification.email, emailVerifiedAt: new Date(), sessionVersion: { increment: 1 } } });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      if (user.email !== verification.email) {
        await enqueueEmail(tx, emailChangedPayload({ email: user.email, locale }));
      } else if (!user.emailVerifiedAt) {
        const code = `WELCOME10-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        await tx.coupon.create({ data: { code, discountType: 'percentage', discountValue: 10, maxUses: 1, userId: user.id, campaign: 'welcome', expiresAt: new Date(Date.now() + 30 * 86400000) } });
        await enqueueEmail(tx, welcomeEmailPayload({ email: user.email, firstName: user.firstName, locale, welcomeCouponCode: code }));
      }
    });
  }
}
