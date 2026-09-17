import { EmailService } from '../../src/core/email/email.service';
import { escapeHtml } from '../../src/core/email/html';
import { CacheService } from '../../src/core/cache/cache.service';

jest.mock('../../src/core/observability/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; jest.restoreAllMocks(); });
const message = { to: 'test@example.com', subject: 'Test', html: '<p>Private</p>', idempotencyKey: 'job-1' };
describe('Outbound email transport failure contracts', () => {
  it.each(['resend', 'postmark'])('%s sends once with a timeout and throws on failure so the outbox retries', async (provider) => {
    process.env.EMAIL_FROM = 'sender@example.com';
    process.env.RESEND_API_KEY = provider === 'resend' ? 'synthetic' : '';
    process.env.POSTMARK_API_KEY = provider === 'postmark' ? 'synthetic' : '';
    process.env.POSTMARK_STREAM = 'outbound-test';
    const cancel = jest.fn().mockResolvedValue(undefined);
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true } as any).mockResolvedValueOnce({ ok: false, status: 429, body: { cancel } } as any);
    const service = new EmailService();
    await service.send(message);
    expect(fetch).toHaveBeenCalledTimes(1);
    const options = fetch.mock.calls[0][1]!; expect(options.signal).toBeInstanceOf(AbortSignal);
    if (provider === 'resend') expect(options.headers).toMatchObject({ 'Idempotency-Key': 'job-1' });
    expect(JSON.parse(options.body as string)).toMatchObject(provider === 'resend' ? { to: [message.to] } : { To: message.to });
    await expect(service.send(message)).rejects.toThrow('429'); expect(cancel).toHaveBeenCalled();
  });
  it('never makes network requests when no provider is configured', async () => {
    delete process.env.RESEND_API_KEY; delete process.env.POSTMARK_API_KEY; delete process.env.EMAIL_FROM;
    const fetch = jest.spyOn(global, 'fetch');
    await new EmailService().send(message); expect(fetch).not.toHaveBeenCalled();
  });
  it('escapes user-controlled markup and quote delimiters', () => {
    expect(escapeHtml('<img src="x" onerror=\'alert(1)\'> &')).toBe('&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp;');
    expect(escapeHtml(undefined)).toBe('');
  });
  it('bypasses an unavailable Redis connection without queuing commands', async () => {
    const redis = { status: 'reconnecting', get: jest.fn(), set: jest.fn(), del: jest.fn(), scan: jest.fn() };
    const cache = new CacheService(redis as any);
    expect(await cache.get('product')).toBeNull(); await cache.set('product', {}, 10); await cache.delete('product'); await cache.deleteByPattern('products:*');
    for (const name of ['get', 'set', 'del', 'scan'] as const) expect(redis[name]).not.toHaveBeenCalled();
  });
});

describe('Production environment fails closed', () => {
  function load() { let result: any; jest.isolateModules(() => { result = require('../../src/core/config/env').Env; }); return result; }
  function production() {
    Object.assign(process.env, { NODE_ENV: 'production', CLIENT_URL: 'https://shop.example.com', CORS_ALLOWED_ORIGINS: 'https://shop.example.com', MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), METRICS_TOKEN: 'm'.repeat(40), STRIPE_SECRET_KEY: 'sk_test_synthetic', STRIPE_WEBHOOK_SECRET: 'whsec_synthetic', EMAIL_FROM: 'orders@example.com', RESEND_API_KEY: 'synthetic', SUPPORT_EMAIL: 'support@example.com', SHIPPING_RATES_JSON: JSON.stringify([{ country: 'CA', feeCents: 995, freeThresholdCents: null }]) });
    delete process.env.POSTMARK_API_KEY;
  }
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); jest.spyOn(process, 'exit').mockImplementation((() => { throw new Error('Configuration rejected'); }) as any); });
  it('accepts explicit production origins, transport, encryption and metrics configuration', () => { production(); expect(load().NODE_ENV).toBe('production'); });
  it.each(['MFA_ENCRYPTION_KEY', 'METRICS_TOKEN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'EMAIL_FROM', 'CLIENT_URL', 'CORS_ALLOWED_ORIGINS', 'RESEND_API_KEY', 'SUPPORT_EMAIL', 'SHIPPING_RATES_JSON'])('rejects missing %s', (name) => {
    production(); delete process.env[name]; expect(load).toThrow('Configuration rejected');
  });
  it('accepts Postmark as the alternative transport', () => { production(); delete process.env.RESEND_API_KEY; process.env.POSTMARK_API_KEY = 'synthetic'; expect(load().POSTMARK_API_KEY).toBe('synthetic'); });
  it.each([{ CLIENT_URL: 'http://shop.example.com' }, { MFA_ENCRYPTION_KEY: 'too-short' }, { JWT_ACCESS_EXPIRY: '0' }, { PORT: '-1' }, { DATABASE_URL: '' }])('rejects invalid configuration %j', (invalid) => {
    production(); Object.assign(process.env, invalid); expect(load).toThrow('Configuration rejected');
  });
});
