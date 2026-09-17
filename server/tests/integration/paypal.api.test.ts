import request from 'supertest';
import crypto from 'node:crypto';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { registerTestUser } from '../helpers/auth.helper';
import { PaymentsService } from '../../src/features/payments/payments.service';
import { OrdersRepository } from '../../src/features/orders/orders.repository';
import { paypalGateway, type PaypalOrder } from '../../src/features/payments/paypal.gateway';
import { Env } from '../../src/core/config/env';

const service = new PaymentsService(new OrdersRepository());
const email = 'paypal-test@example.com';
const shipping = { firstName: 'PayPal', lastName: 'Tester', addressLine1: '1 Test St', city: 'Ottawa', province: 'ON', country: 'CA', postalCode: 'K1A 0B1' };
let remote: PaypalOrder;
let gateway: jest.SpyInstance;
beforeAll(setupTestDatabase);
beforeEach(async () => {
  await cleanDatabase();
  Env.PAYPAL_ENVIRONMENT = 'sandbox';
  gateway = jest.spyOn(paypalGateway, 'request').mockImplementation(async (path, method) => {
    if (path.endsWith('/capture') && method === 'POST') {
      remote = { ...remote, status: 'COMPLETED', purchase_units: [{ ...remote.purchase_units![0], payments: { captures: [{ id: 'CAPTURE123', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '59.95' } }] } }] };
    }
    return remote as never;
  });
});
afterEach(() => jest.restoreAllMocks());
afterAll(teardownTestDatabase);
async function fixture(member = false) {
  const product = await prisma.product.create({ data: { name: 'PayPal product', price: 5000, category: 'hoodies', sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock: 4 } } } });
  const result = await request(app).post('/api/v1/orders/guest').send({ ...shipping, email, checkoutKey: crypto.randomUUID(), items: [{ productId: product.id, size: 'M', color: 'Black', quantity: 1 }] }).expect(201);
  const order = result.body.data;
  let userId: string | null = null;
  if (member) { const user = await registerTestUser(); userId = user.id; await prisma.order.update({ where: { id: order.id }, data: { userId, guestEmail: null } }); }
  remote = { id: 'REMOTE123', status: 'CREATED', purchase_units: [{ custom_id: order.id, amount: { currency_code: 'CAD', value: '59.95' } }], links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=REMOTE123' }] };
  return { order, product, userId };
}
async function prepared(member = false) {
  const f = await fixture(member); await service.paypal.create(f.order.id, f.userId, email); remote.status = 'APPROVED'; return f;
}
test('creates a provider order using authoritative CAD total, address and fixed return URLs', async () => {
  const { order } = await fixture();
  const response = await request(app).post('/api/v1/payments/paypal/create').send({ orderId: order.id, email }).expect(200);
  expect(response.body.data.approvalUrl).toContain('https://www.sandbox.paypal.com/');
  expect(gateway).toHaveBeenCalledWith('/v2/checkout/orders', 'POST', expect.objectContaining({ intent: 'CAPTURE', purchase_units: [expect.objectContaining({ custom_id: order.id, amount: { currency_code: 'CAD', value: '59.95' } })] }), order.id);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentProvider).toBe('paypal');
  await service.paypal.create(order.id, null, email);
  expect(gateway.mock.calls.filter(call => call[0] === '/v2/checkout/orders')).toHaveLength(1);
});
test('rejects ownership forgery and caller-supplied prices', async () => {
  const { order } = await fixture();
  await request(app).post('/api/v1/payments/paypal/create').send({ orderId: order.id, email: 'other@example.com' }).expect(403);
  await request(app).post('/api/v1/payments/paypal/create').send({ orderId: order.id, email, amount: 1 }).expect(422);
  await request(app).post('/api/v1/payments/paypal/capture').send({ orderId: order.id }).expect(403);
  expect(gateway).not.toHaveBeenCalled();
});
test.each(['amount', 'currency', 'binding', 'redirect'])('rejects incorrect provider %s and rolls back binding', async kind => {
  const { order } = await fixture();
  if (kind === 'amount') remote.purchase_units![0].amount.value = '0.01';
  if (kind === 'currency') remote.purchase_units![0].amount.currency_code = 'USD';
  if (kind === 'binding') remote.purchase_units![0].custom_id = crypto.randomUUID();
  if (kind === 'redirect') remote.links![0].href = 'https://www.sandbox.paypal.com.evil.invalid/';
  await expect(service.paypal.create(order.id, null, email)).rejects.toThrow();
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).transactionKey).toBeNull();
});
test('does not switch provider while a payment exists', async () => {
  const { order } = await prepared();
  await expect(service.createGuestPaymentIntent(order.id, email)).rejects.toThrow(/changing provider/);
  await prisma.order.update({ where: { id: order.id }, data: { paymentProvider: 'stripe', transactionKey: 'pi_existing' } });
  await expect(service.paypal.create(order.id, null, email)).rejects.toThrow(/changing provider/);
});
test('captures concurrently once, settles once and sends one confirmation', async () => {
  const { order } = await prepared();
  const results = await Promise.all([service.paypal.capture(order.id, null, email), service.paypal.capture(order.id, null, email)]);
  expect(results.map(r => r.paymentStatus)).toEqual(['paid', 'paid']);
  expect(gateway.mock.calls.filter(call => call[0].endsWith('/capture'))).toHaveLength(1);
  expect(await prisma.emailOutbox.count({ where: { id: `order-confirmation-${order.id}` } })).toBe(1);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paypalCaptureId).toBe('CAPTURE123');
});
test('member payments award loyalty exactly once and cannot be captured as guest', async () => {
  const { order, userId } = await prepared(true);
  await expect(service.paypal.capture(order.id, null, email)).rejects.toThrow(/access/);
  await service.paypal.capture(order.id, userId); await service.paypal.capture(order.id, userId);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: userId! } })).loyaltyPoints).toBe(59);
});
test('approval alone is not payment and unapproved requests never reserve capture', async () => {
  const { order } = await fixture(); await service.paypal.create(order.id, null, email);
  await expect(service.paypal.capture(order.id, null, email)).rejects.toThrow(/Approve/);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paypalCaptureRequestedAt).toBeNull();
});
test('expired reservations cannot start a capture', async () => {
  const { order } = await prepared(); await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(0) } });
  await expect(service.paypal.capture(order.id, null, email)).rejects.toThrow(/no longer payable/);
});
test('cancellation releases stock and prevents subsequent capture', async () => {
  const { order, product } = await prepared();
  expect(await service.cancelPendingOrder(order.id)).toBe('cancelled');
  expect((await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } })).stock).toBe(4);
  await expect(service.paypal.capture(order.id, null, email)).rejects.toThrow(/no longer payable/);
});
test('ambiguous capture timeout retains stock; retry reconciles without a second charge', async () => {
  const { order, product } = await prepared();
  gateway.mockImplementationOnce(async () => remote).mockImplementationOnce(async () => remote).mockRejectedValueOnce(new Error('timeout'));
  await expect(service.paypal.capture(order.id, null, email)).rejects.toThrow('timeout');
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paypalCaptureRequestedAt).not.toBeNull();
  await expect(service.cancelPendingOrder(order.id)).rejects.toThrow(/reconciled/);
  expect((await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } })).stock).toBe(3);
  remote.status = 'COMPLETED'; remote.purchase_units![0].payments = { captures: [{ id: 'CAPTURE123', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '59.95' } }] };
  expect(await service.paypal.capture(order.id, null, email)).toEqual({ paymentStatus: 'paid' });
});
test('reconciliation after the safe retry window does not issue a new capture', async () => {
  const { order } = await prepared(); await prisma.order.update({ where: { id: order.id }, data: { paypalCaptureRequestedAt: new Date(0) } });
  await expect(service.paypal.capture(order.id, null, email)).rejects.toThrow(/support/);
  expect(gateway.mock.calls.some(call => call[0].endsWith('/capture'))).toBe(false);
});
test('full refund settles once, reverses loyalty and never restocks automatically', async () => {
  const { order, product, userId } = await prepared(true); await service.paypal.capture(order.id, userId);
  gateway.mockResolvedValueOnce({ id: 'REFUND123', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '59.95' } });
  expect(await service.refundOrder(order.id, 'Test', 0)).toEqual({ refundId: 'REFUND123', amountRefunded: 5995 });
  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } }); expect(updated.paymentStatus).toBe('refunded');
  expect((await prisma.user.findUniqueOrThrow({ where: { id: userId! } })).loyaltyPoints).toBe(0);
  expect((await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } })).stock).toBe(3);
  await expect(service.refundOrder(order.id, 'Test', 0)).rejects.toThrow(/balance changed/);
});
test('pending refunds are polled instead of recreated and do not prematurely reverse payment', async () => {
  const { order } = await prepared(); await service.paypal.capture(order.id, null, email);
  gateway.mockResolvedValueOnce({ id: 'REFUND123', status: 'PENDING', amount: { currency_code: 'CAD', value: '59.95' } });
  await service.refundOrder(order.id, undefined, 0);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('paid');
  gateway.mockResolvedValueOnce({ id: 'REFUND123', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '59.95' } });
  await service.refundOrder(order.id, undefined, 0);
  expect(gateway).toHaveBeenLastCalledWith('/v2/payments/refunds/REFUND123');
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('refunded');
});
test('webhook requires verified signature before touching an order', async () => {
  jest.spyOn(paypalGateway, 'verify').mockRejectedValue(new Error('invalid signature'));
  const { order } = await prepared(); gateway.mockClear();
  await expect(service.paypal.webhook({}, { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAPTURE123' } })).rejects.toThrow('invalid signature');
  expect(gateway).not.toHaveBeenCalled();
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('pending');
});
test('verified webhook repairs lost capture response and duplicate delivery has no side effects', async () => {
  const { order } = await prepared();
  jest.spyOn(paypalGateway, 'verify').mockResolvedValue();
  remote.status = 'COMPLETED'; remote.purchase_units![0].payments = { captures: [{ id: 'CAPTURE123', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '59.95' } }] };
  const event = { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAPTURE123', supplementary_data: { related_ids: { order_id: remote.id } } } };
  await service.paypal.webhook({}, event); await service.paypal.webhook({}, event);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('paid');
  expect(await prisma.emailOutbox.count({ where: { id: `order-confirmation-${order.id}` } })).toBe(1);
});

test('refund webhooks reconcile cumulative partial amounts and ignore replay or reordering', async () => {
  const { order } = await prepared(); await service.paypal.capture(order.id, null, email);
  jest.spyOn(paypalGateway, 'verify').mockResolvedValue();
  const refunds: Record<string, { id: string; status: string; amount: { currency_code: string; value: string } }> = {
    REFUND1: { id: 'REFUND1', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '10.00' } },
    REFUND2: { id: 'REFUND2', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '5.00' } },
  };
  gateway.mockImplementation(async path => path.includes('/refunds/') ? refunds[path.split('/').pop()!] : remote);
  const event = (id: string) => ({ event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { id, links: [{ rel: 'up', href: 'https://api.sandbox.paypal.com/v2/payments/captures/CAPTURE123' }] } });
  await service.paypal.webhook({}, event('REFUND2')); await service.paypal.webhook({}, event('REFUND1')); await service.paypal.webhook({}, event('REFUND1'));
  refunds.REFUND1.status = 'PENDING'; await service.paypal.webhook({}, event('REFUND1'));
  expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ paymentStatus: 'partially_refunded', refundedCents: 1500 });
  expect(await prisma.paypalRefund.count()).toBe(2);
});
test('refund overpayment and refund currency mismatch are rejected atomically', async () => {
  const { order } = await prepared(); await service.paypal.capture(order.id, null, email);
  for (const amount of [{ currency_code: 'CAD', value: '999.00' }, { currency_code: 'USD', value: '59.95' }]) {
    gateway.mockResolvedValueOnce({ id: 'BADREFUND', status: 'COMPLETED', amount });
    await expect(service.refundOrder(order.id, undefined, 0)).rejects.toThrow();
    expect(await prisma.paypalRefund.count()).toBe(0);
  }
});
test('declined captures allow cancellation while pending captures retain stock', async () => {
  const { order } = await prepared();
  await prisma.order.update({ where: { id: order.id }, data: { paypalCaptureRequestedAt: new Date() } });
  remote.purchase_units![0].payments = { captures: [{ id: 'CAPTURE123', status: 'PENDING', amount: { currency_code: 'CAD', value: '59.95' } }] };
  await expect(service.cancelPendingOrder(order.id)).rejects.toThrow(/reconciled/);
  remote.purchase_units![0].payments!.captures![0].status = 'DECLINED';
  expect(await service.cancelPendingOrder(order.id)).toBe('cancelled');
});
test('a captured amount mismatch never authorizes fulfillment', async () => {
  const { order } = await prepared();
  remote.status = 'COMPLETED'; remote.purchase_units![0].payments = { captures: [{ id: 'CAPTURE123', status: 'COMPLETED', amount: { currency_code: 'CAD', value: '0.01' } }] };
  await expect(service.cancelPendingOrder(order.id)).rejects.toThrow(/amount mismatch/);
  expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('pending');
});
