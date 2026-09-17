import { Env } from '../../core/config/env';
import { ValidationError } from '../../core/errors/http.errors';

export type PaypalMoney = { currency_code: string; value: string };
export type PaypalCapture = { id: string; status: string; amount: PaypalMoney };
export type PaypalOrder = {
  id: string; status: string;
  purchase_units?: Array<{ custom_id?: string; amount: PaypalMoney; payments?: { captures?: PaypalCapture[] } }>;
  links?: Array<{ rel: string; href: string }>;
};
export type PaypalRefund = { id: string; status: string; amount: PaypalMoney; links?: Array<{ rel: string; href: string }> };

export function paypalConfigured(): boolean {
  return !!(Env.PAYPAL_CLIENT_ID && Env.PAYPAL_CLIENT_SECRET && Env.PAYPAL_WEBHOOK_ID);
}

export function paypalCents(money: PaypalMoney): number {
  if (money?.currency_code !== 'CAD' || !/^\d+\.\d{2}$/.test(money.value)) throw new ValidationError('PayPal currency or amount mismatch.');
  const cents = Number(money.value.replace('.', ''));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new ValidationError('Invalid PayPal amount.');
  return cents;
}

// Only fixed PayPal API origins are used. Never fetch a link supplied by a webhook.
export class PaypalGateway {
  private token?: { value: string; expires: number };
  private get origin(): string { return Env.PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; }

  async request<T>(path: string, method = 'GET', body?: unknown, requestId?: string): Promise<T> {
    if (!paypalConfigured()) throw new ValidationError('PayPal is not configured.');
    if (!this.token || this.token.expires < Date.now()) {
      const response = await fetch(`${this.origin}/v1/oauth2/token`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Basic ${Buffer.from(`${Env.PAYPAL_CLIENT_ID}:${Env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      });
      if (!response.ok) throw new Error('PayPal authentication unavailable.');
      const data = await response.json() as { access_token: string; expires_in: number };
      if (!data.access_token || !Number.isFinite(data.expires_in)) throw new Error('Invalid PayPal authentication response.');
      this.token = { value: data.access_token, expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
    }
    const response = await fetch(`${this.origin}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(7000),
      headers: { Authorization: `Bearer ${this.token.value}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      if (response.status === 401) this.token = undefined;
      // Provider bodies may contain personal data; don't return/log them.
      throw new Error(`PayPal request failed (${response.status}). Retry or contact support.`);
    }
    return response.json() as Promise<T>;
  }

  async verify(headers: Record<string, string | string[] | undefined>, event: unknown): Promise<void> {
    const value = (name: string) => {
      const item = headers[name];
      if (typeof item !== 'string' || !item || item.length > 2048) throw new ValidationError('Invalid PayPal webhook signature.');
      return item;
    };
    const data = await this.request<{ verification_status: string }>('/v1/notifications/verify-webhook-signature', 'POST', {
      auth_algo: value('paypal-auth-algo'), cert_url: value('paypal-cert-url'), transmission_id: value('paypal-transmission-id'),
      transmission_sig: value('paypal-transmission-sig'), transmission_time: value('paypal-transmission-time'),
      webhook_id: Env.PAYPAL_WEBHOOK_ID, webhook_event: event,
    });
    if (data.verification_status !== 'SUCCESS') throw new ValidationError('Invalid PayPal webhook signature.');
  }
}

export const paypalGateway = new PaypalGateway();
