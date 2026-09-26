import crypto from 'node:crypto';
import { NewsletterRepository } from './newsletter.repository';
import { prisma } from '../../core/database/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { hashToken } from '../../core/security/secrets';
import { enqueueEmail } from '../../core/email/outbox';
import { escapeHtml } from '../../core/email/html';
import { Env } from '../../core/config/env';
import { ValidationError } from '../../core/errors/http.errors';

export interface SubscribeResult { alreadySubscribed: boolean }
export class NewsletterService {
  constructor(private readonly newsletterRepository: NewsletterRepository) {}

  async subscribe(email: string): Promise<SubscribeResult> {
    await transaction(async (tx) => {
      await lockResource(tx, `newsletter:${email}`);
      const existing = await tx.newsletterSubscription.findUnique({ where: { email } });
      if (existing?.isActive && existing.confirmedAt) return;
      const token = crypto.randomBytes(32).toString('hex');
      const data = { isActive: false, consentVersion: '2026-09-16', consentAt: new Date(), tokenHash: hashToken(token), tokenExpiresAt: new Date(Date.now() + 86400000) };
      await tx.newsletterSubscription.upsert({ where: { email }, create: { email, ...data }, update: data });
      const url = `${Env.CLIENT_URL}/newsletter/confirm#token=${token}`;
      await enqueueEmail(tx, { to: email, subject: 'BLE$$ P: Confirm newsletter subscription / Confirmez votre abonnement', html: `<p><a href="${escapeHtml(url)}">Confirm subscription / Confirmer l’abonnement</a></p><p>Ignore this message if you did not request it. / Ignorez ce message si vous n’êtes pas à l’origine de la demande.</p>` });
    });
    return { alreadySubscribed: false };
  }

  async confirm(token: string): Promise<void> {
    await transaction(async (tx) => {
      const existing = await tx.newsletterSubscription.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!existing || !existing.tokenExpiresAt || existing.tokenExpiresAt <= new Date()) throw new ValidationError('Invalid or expired confirmation link.');
      await lockResource(tx, `newsletter:${existing.email}`);
      const unsubscribeToken = crypto.randomBytes(32).toString('hex');
      const changed = await tx.newsletterSubscription.updateMany({ where: { id: existing.id, tokenHash: hashToken(token) }, data: { isActive: true, confirmedAt: new Date(), revokedAt: null, tokenHash: null, tokenExpiresAt: null, unsubscribeHash: hashToken(unsubscribeToken) } });
      if (!changed.count) throw new ValidationError('Confirmation link already used.');
      const url = `${Env.CLIENT_URL}/newsletter/confirm#unsubscribe=${unsubscribeToken}`;
      await enqueueEmail(tx, { to: existing.email, subject: 'BLE$$ P: Subscription confirmed / Abonnement confirmé', html: `<p>Your subscription is active. / Votre abonnement est actif.</p><p><a href="${escapeHtml(url)}">Unsubscribe / Se désabonner</a></p>` });
    });
  }

  async unsubscribe(token: string): Promise<void> {
    await prisma.newsletterSubscription.updateMany({ where: { unsubscribeHash: hashToken(token) }, data: { isActive: false, revokedAt: new Date(), tokenHash: null, tokenExpiresAt: null } });
  }
}
