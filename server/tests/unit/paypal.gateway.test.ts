import { PaypalGateway, paypalCents } from '../../src/features/payments/paypal.gateway';
import { Env } from '../../src/core/config/env';

describe('PayPal boundary', () => {
  const original = { ...Env };
  beforeEach(() => { Env.PAYPAL_CLIENT_ID = 'synthetic'; Env.PAYPAL_CLIENT_SECRET = 'synthetic-secret'; Env.PAYPAL_WEBHOOK_ID = 'synthetic-hook'; Env.PAYPAL_ENVIRONMENT = 'sandbox'; });
  afterEach(() => { Object.assign(Env, original); jest.restoreAllMocks(); });
  test.each(['0.01', '59.95', '1000000.00'])('parses exact CAD cents %s', value => expect(paypalCents({ currency_code: 'CAD', value })).toBe(Math.round(Number(value) * 100)));
  test.each(['0.00', '-1.00', '1e3', '59.999', 'Infinity', '9007199254740992.00'])('rejects malformed or unsafe amount %s', value => expect(() => paypalCents({ currency_code: 'CAD', value })).toThrow());
  test('rejects a currency substitution', () => expect(() => paypalCents({ currency_code: 'USD', value: '59.95' })).toThrow());
  test('uses sandbox origin, caches access token, and sends stable request ID', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'synthetic-token', expires_in: 3600 }) } as Response).mockResolvedValue({ ok: true, json: async () => ({ id: 'REMOTE' }) } as Response);
    const gateway = new PaypalGateway();
    await gateway.request('/v2/checkout/orders', 'POST', { intent: 'CAPTURE' }, 'request-id'); await gateway.request('/v2/checkout/orders/REMOTE');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ redirect: 'error', headers: { 'PayPal-Request-Id': 'request-id', Authorization: 'Bearer synthetic-token' } });
  });
  test('does not leak provider response or credentials when provider fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'secret-token', expires_in: 3600 }) } as Response).mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ personal: 'private@example.com' }) } as Response);
    await expect(new PaypalGateway().request('/v2/checkout/orders')).rejects.toThrow('PayPal request failed (422). Retry or contact support.');
  });
  test('rejects incomplete signatures locally and unsuccessful remote verification', async () => {
    const gateway = new PaypalGateway(); const request = jest.spyOn(gateway, 'request').mockResolvedValue({ verification_status: 'FAILURE' });
    await expect(gateway.verify({}, {})).rejects.toThrow(/signature/); expect(request).not.toHaveBeenCalled();
    await expect(gateway.verify({ 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/test', 'paypal-transmission-id': 'test', 'paypal-transmission-sig': 'test', 'paypal-transmission-time': '2026-09-17T00:00:00Z' }, {})).rejects.toThrow(/signature/);
  });
});
