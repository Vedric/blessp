import { logger } from '../observability/logger';

export interface EmailPayload {
  idempotencyKey?: string;
  to: string;
  subject: string;
  html: string;
}

type Provider = 'resend' | 'postmark' | 'log';

/**
 * EmailService dispatches transactional mail through the first configured
 * provider. The order of precedence (Resend, Postmark, log) lets the team
 * swap providers without code changes and keeps local development
 * dependency-free by logging content when no API key is present.
 *
 * Environment:
 *   EMAIL_FROM         required in production (e.g. "BLE$P <no-reply@blessp.com>")
 *   RESEND_API_KEY     activates the Resend transport
 *   POSTMARK_API_KEY   activates the Postmark transport
 *
 * Without any key, we log the payload: fine for dev, explicitly refused
 * by production startup checks elsewhere.
 */
export class EmailService {
  private readonly provider: Provider;
  private readonly from: string;

  constructor() {
    this.from =
      process.env.EMAIL_FROM ?? 'BLE$P <no-reply@blessp.localhost>';
    if (process.env.RESEND_API_KEY) {
      this.provider = 'resend';
    } else if (process.env.POSTMARK_API_KEY) {
      this.provider = 'postmark';
    } else {
      this.provider = 'log';
      if (process.env.NODE_ENV === 'production') {
        logger.warn(
          'No email provider configured in production. Emails will be logged only; customers will not receive messages.',
        );
      }
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    switch (this.provider) {
      case 'resend':
        await this.sendViaResend(payload);
        return;
      case 'postmark':
        await this.sendViaPostmark(payload);
        return;
      default:
        logger.info(
          { to: payload.to, subject: payload.subject, provider: 'log' },
          'Email captured (no provider configured)',
        );

    }
  }

  private async sendViaResend(payload: EmailPayload): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      logger.error(
        { status: res.status, to: payload.to, subject: payload.subject },
        'Resend send failed',
      );
      throw new Error(`Resend send failed with status ${res.status}`);
    }
    logger.info(
      { to: payload.to, subject: payload.subject, provider: 'resend' },
      'Email delivered',
    );
  }

  private async sendViaPostmark(payload: EmailPayload): Promise<void> {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': process.env.POSTMARK_API_KEY!,
      },
      body: JSON.stringify({
        From: this.from,
        To: payload.to,
        Subject: payload.subject,
        HtmlBody: payload.html,
        MessageStream: process.env.POSTMARK_STREAM ?? 'outbound',
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      logger.error(
        { status: res.status, to: payload.to, subject: payload.subject },
        'Postmark send failed',
      );
      throw new Error(`Postmark send failed with status ${res.status}`);
    }
    logger.info(
      { to: payload.to, subject: payload.subject, provider: 'postmark' },
      'Email delivered',
    );
  }
}

export const emailService = new EmailService();
