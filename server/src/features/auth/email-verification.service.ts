import crypto from 'node:crypto';
import { Env } from '../../core/config/env';
import { prisma } from '../../core/database/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { hashToken } from '../../core/security/secrets';
import { UnauthorizedError } from '../../core/errors/http.errors';
import { enqueueEmail } from '../../core/email/outbox';
import { escapeHtml } from '../../core/email/html';

export class EmailVerificationService {
  async request(userId: string, email: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await transaction(async (tx) => {
      await lockResource(tx, `session:${userId}`);
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.create({ data: { userId, email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) } });
      const url = `${Env.CLIENT_URL}/verify-email#token=${token}`;
      await enqueueEmail(tx, { to: email, subject: 'BLE$$ P — Verify your email / Vérifiez votre adresse', html: `<p>Confirm your email address within one hour. / Confirmez votre adresse dans l’heure.</p><p><a href="${escapeHtml(url)}">Confirm / Confirmer</a></p><p>If you did not request this, ignore this message. / Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>` });
    });
  }

  async resend(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
    if (user && !user.emailVerifiedAt) await this.request(user.id, user.email);
  }

  async confirm(token: string): Promise<void> {
    await transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!verification || verification.expiresAt <= new Date()) throw new UnauthorizedError('Invalid or expired verification link.');
      await lockResource(tx, `session:${verification.userId}`);
      const consumed = await tx.emailVerificationToken.deleteMany({ where: { id: verification.id } });
      if (consumed.count !== 1) throw new UnauthorizedError('Verification link already used.');
      const user = await tx.user.findUniqueOrThrow({ where: { id: verification.userId, deletedAt: null } });
      await tx.user.update({ where: { id: user.id }, data: { email: verification.email, emailVerifiedAt: new Date(), sessionVersion: { increment: 1 } } });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      if (user.email !== verification.email) {
        await enqueueEmail(tx, { to: user.email, subject: 'BLE$$ P — Email address changed', html: '<p>Your account email address was changed. Contact support immediately if you did not request this.</p>' });
      } else if (!user.emailVerifiedAt) {
        const code = `WELCOME10-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        await tx.coupon.create({ data: { code, discountType: 'percentage', discountValue: 10, maxUses: 1, userId: user.id, campaign: 'welcome', expiresAt: new Date(Date.now() + 30 * 86400000) } });
        await enqueueEmail(tx, { to: user.email, subject: 'Welcome / Bienvenue — BLE$$ P', html: `<p>Welcome, ${escapeHtml(user.firstName)}!</p><p>Your personal welcome code / Votre code personnel : <strong>${code}</strong> (10%, 30 days / jours).</p>` });
      }
    });
  }
}
