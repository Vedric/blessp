import request from 'supertest';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { createAdminUser, registerTestUser } from '../helpers/auth.helper';
import { PaymentsService } from '../../src/features/payments/payments.service';
import { OrdersRepository } from '../../src/features/orders/orders.repository';
import { drainEmailOutbox } from '../../src/core/email/outbox';
import { emailService } from '../../src/core/email/email.service';
import { Env } from '../../src/core/config/env';

beforeAll(setupTestDatabase);
const originalRates = Env.SHIPPING_RATES_JSON;
afterEach(async () => { Env.SHIPPING_RATES_JSON = originalRates; jest.restoreAllMocks(); await cleanDatabase(); });
afterAll(teardownTestDatabase);
const shipping = { firstName: 'Resilience', lastName: 'Buyer', addressLine1: '1 Test Street', city: 'Montreal', province: 'QC', postalCode: 'H2X 1Y4', country: 'CA' };
async function product(stock = 20, price = 10000) {
  return prisma.product.create({ data: { name: 'Concurrent product', price, colors: ['Black'], sizes: ['M'], variants: { create: { stock, color: 'Black', size: 'M' } } }, include: { variants: true } });
}
function checkout(productId: string) {
  return { ...shipping, email: 'resilience@example.com', checkoutKey: crypto.randomUUID(), items: [{ productId, quantity: 1, size: 'M', color: 'Black' }] };
}
function event(order: { id: string; totalCents: number }, id: string, refunded?: number) {
  const type = refunded === undefined ? 'payment_intent.succeeded' : 'charge.refunded';
  const payload = JSON.stringify({ id, type, data: { object: {
    id: refunded === undefined ? 'pi_resilience' : 'ch_resilience', payment_intent: 'pi_resilience',
    amount: order.totalCents, amount_received: order.totalCents, amount_refunded: refunded,
    currency: 'cad', metadata: { orderId: order.id },
  } } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  return request(app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
}

it('32 simultaneous buyers cannot oversell seven available units', async () => {
  const p = await product(7);
  const responses = await Promise.all(Array.from({ length: 32 }, () => request(app).post('/api/v1/orders/guest').send(checkout(p.id))));
  expect(responses.filter(r => r.status === 201)).toHaveLength(7);
  expect(responses.filter(r => r.status === 422)).toHaveLength(25);
  expect(await prisma.order.count()).toBe(7);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(0);
});

it('16 concurrent retries create one reservation and preserve its original price snapshot', async () => {
  const p = await product(3); const body = checkout(p.id);
  const responses = await Promise.all(Array.from({ length: 16 }, () => request(app).post('/api/v1/orders/guest').send(body).expect(201)));
  expect(new Set(responses.map(r => r.body.data.id)).size).toBe(1);
  await prisma.product.update({ where: { id: p.id }, data: { price: 20000 } });
  const replay = await request(app).post('/api/v1/orders/guest').send(body).expect(201);
  expect(replay.body.data.totalCents).toBe(10000);
  expect(replay.body.data.items[0].unitPriceCents).toBe(10000);
  expect(await prisma.order.count()).toBe(1);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(2);
});

it('coupon contention rolls back losing stock reservations and repeated cancellations release once', async () => {
  const p = await product(20);
  await prisma.coupon.create({ data: { code: 'BURST', discountType: 'fixed', discountValue: 100, maxUses: 5 } });
  const responses = await Promise.all(Array.from({ length: 20 }, () => request(app).post('/api/v1/orders/guest').send({ ...checkout(p.id), couponCode: 'BURST' })));
  const winners = responses.filter(r => r.status === 201);
  expect(winners).toHaveLength(5); expect(responses.filter(r => r.status === 422)).toHaveLength(15);
  expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'BURST' } })).currentUses).toBe(5);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(15);
  await Promise.all(winners.flatMap(r => [1, 2, 3].map(() => request(app).post('/api/v1/payments/cancel').send({ orderId: r.body.data.id, email: 'resilience@example.com' }).expect(204))));
  expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'BURST' } })).currentUses).toBe(0);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(20);
  expect(await prisma.orderStatusHistory.count({ where: { status: 'cancelled' } })).toBe(5);
});

it('parallel signed payment and out-of-order refund events preserve one payment and monotonic totals', async () => {
  const user = await registerTestUser(); await prisma.emailOutbox.deleteMany();
  const p = await product();
  const response = await request(app).post('/api/v1/orders/guest').send(checkout(p.id)).expect(201);
  const order = await prisma.order.update({ where: { id: response.body.data.id }, data: { userId: user.id, guestEmail: null, transactionKey: 'pi_resilience' } });
  await Promise.all(Array.from({ length: 16 }, (_, i) => event(order, `evt_success_${i % 4}`).expect(200)));
  expect(await prisma.emailOutbox.count()).toBe(1);
  expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(1);
  await Promise.all([5000, 1000, 7500, 3000, 7500, 2000].map((amount, i) => event(order, `evt_refund_${i}`, amount).expect(200)));
  const latest = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  expect(latest.refundedCents).toBe(7500); expect(latest.paymentStatus).toBe('partially_refunded');
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).loyaltyPoints).toBe(25);
  expect(await prisma.emailOutbox.count()).toBe(1);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(19);
});

it('expiry racing a successful webhook reconciles payment before releasing any stock', async () => {
  const p = await product(1);
  const response = await request(app).post('/api/v1/orders/guest').send(checkout(p.id)).expect(201);
  const order = await prisma.order.update({ where: { id: response.body.data.id }, data: { transactionKey: 'pi_resilience', expiresAt: new Date(0) } });
  let release!: () => void, entered!: () => void, verified!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const retrieved = new Promise<void>(resolve => { entered = resolve; });
  const webhookArrived = new Promise<void>(resolve => { verified = resolve; });
  const remote = {
    webhooks: { constructEvent: (...args: Parameters<typeof Stripe.webhooks.constructEvent>) => { const result = Stripe.webhooks.constructEvent(...args); verified(); return result; } },
    paymentIntents: { retrieve: jest.fn(async () => { entered(); await held; return { id: 'pi_resilience', currency: 'cad', amount: order.totalCents, amount_received: order.totalCents, status: 'succeeded' }; }), cancel: jest.fn() },
  };
  jest.spyOn(PaymentsService.prototype as any, 'requireStripe').mockReturnValue(remote);
  const service = new PaymentsService(new OrdersRepository());
  const expiry = service.expireReservations();
  await retrieved;
  const webhook = event(order, 'evt_expiry_race').then(r => r);
  try { await webhookArrived; release(); await expiry; expect((await webhook).status).toBe(200); }
  finally { release(); await Promise.allSettled([expiry, webhook]); }
  const latest = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  expect(latest.paymentStatus).toBe('paid'); expect(latest.stockReleasedAt).toBeNull();
  expect(remote.paymentIntents.cancel).not.toHaveBeenCalled();
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(0);
  expect(await prisma.emailOutbox.count()).toBe(1);
});

it('outbox workers skip a crashed worker lease and reclaim it only after expiry', async () => {
  const payload = { to: 'synthetic@example.com', subject: 'Recovery', html: '<p>synthetic token</p>' };
  await prisma.emailOutbox.createMany({ data: Array.from({ length: 24 }, (_, i) => ({ id: `recovery-${i}`, payload, ...(i === 0 ? { attempts: 1, availableAt: new Date(Date.now() + 120000) } : {}) })) });
  const send = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);
  await Promise.all([drainEmailOutbox(), drainEmailOutbox(), drainEmailOutbox(), drainEmailOutbox()]);
  expect(send).toHaveBeenCalledTimes(23);
  expect(new Set(send.mock.calls.map(([mail]) => mail.idempotencyKey)).size).toBe(23);
  expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: 'recovery-0' } })).processedAt).toBeNull();
  await prisma.emailOutbox.update({ where: { id: 'recovery-0' }, data: { availableAt: new Date(0) } });
  await Promise.all([drainEmailOutbox(), drainEmailOutbox()]);
  expect(send).toHaveBeenCalledTimes(24);
  const recovered = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: 'recovery-0' } });
  expect(recovered.attempts).toBe(2); expect(recovered.payload).toEqual({});
  expect(await prisma.emailOutbox.count({ where: { processedAt: null } })).toBe(0);
});

it.each(['distinct', 'equal'])('unreconciled payments cannot starve later reservations with %s expiries', async expiry => {
  const p = await product(26);
  const responses = await Promise.all(Array.from({ length: 26 }, () => request(app).post('/api/v1/orders/guest').send(checkout(p.id)).expect(201)));
  responses.sort((a, b) => a.body.data.id.localeCompare(b.body.data.id));
  for (let index = 0; index < responses.length; index++) {
    const id = responses[index].body.data.id;
    await prisma.order.update({ where: { id }, data: { expiresAt: new Date(1000 + (expiry === 'equal' ? 0 : index)), ...(index < 25 ? { transactionKey: `pi_${id}` } : {}) } });
  }
  const retrieve = jest.fn().mockRejectedValue(new Error('Synthetic provider outage'));
  jest.spyOn(PaymentsService.prototype as any, 'requireStripe').mockReturnValue({ paymentIntents: { retrieve } });
  const service = new PaymentsService(new OrdersRepository());
  await service.expireReservations();
  expect(await prisma.order.count({ where: { status: 'cancelled' } })).toBe(0);
  await service.expireReservations();
  expect((await prisma.order.findUniqueOrThrow({ where: { id: responses[25].body.data.id } })).status).toBe('cancelled');
  expect(retrieve).toHaveBeenCalledTimes(25);
  // Recover the provider. Previously blocked payments must be visited again.
  retrieve.mockImplementation(async id => ({ id, currency: 'cad', amount: 10000, status: 'canceled' }));
  await service.expireReservations();
  expect(await prisma.order.count({ where: { status: 'cancelled' } })).toBe(26);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(26);
});

it.each([{ name: '   ', price: 100 }, { name: 'Overflow', price: 2147483648 }, { name: 'Overflow sort', price: 100, onfrontOrder: 2147483648 }])('rejects invalid catalogue input without persisting it: %j', async body => {
  const admin = await createAdminUser();
  await request(app).post('/api/v1/products').set('Authorization', `Bearer ${admin.accessToken}`).send(body).expect(422);
  expect(await prisma.product.count()).toBe(0);
});

it('rejects order totals outside storage bounds and restores all reserved stock and coupon usage', async () => {
  const p = await product(3, 2147483647);
  await prisma.coupon.create({ data: { code: 'OVERFLOW', discountType: 'fixed', discountValue: 100, maxUses: 1 } });
  const body = checkout(p.id); body.items[0].quantity = 2;
  await request(app).post('/api/v1/orders/guest').send({ ...body, couponCode: 'OVERFLOW' }).expect(422);
  expect(await prisma.order.count()).toBe(0);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(3);
  expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'OVERFLOW' } })).currentUses).toBe(0);
});

it('includes shipping in the total bound even when the subtotal fits', async () => {
  Env.SHIPPING_RATES_JSON = [{ country: 'CA', feeCents: 1000, freeThresholdCents: null }];
  const p = await product(1, 2147483647);
  await prisma.coupon.create({ data: { code: 'SHIPPINGOVERFLOW', discountType: 'fixed', discountValue: 100, maxUses: 1 } });
  await request(app).post('/api/v1/orders/guest').send({ ...checkout(p.id), couponCode: 'SHIPPINGOVERFLOW' }).expect(422);
  expect(await prisma.order.count()).toBe(0);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(1);
  expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'SHIPPINGOVERFLOW' } })).currentUses).toBe(0);
});

it('accepts trimmed product names and exact integer boundaries, rejecting invalid edits and filters', async () => {
  const admin = await createAdminUser(); const auth = { Authorization: `Bearer ${admin.accessToken}` };
  const created = await request(app).post('/api/v1/products').set(auth).send({ name: '  Valid product  ', price: 2147483647, onfrontOrder: 2147483647 }).expect(201);
  expect(created.body.data.name).toBe('Valid product');
  for (const body of [{ name: ' \n ' }, { price: 2147483648 }, { onfrontOrder: 2147483648 }]) {
    await request(app).patch(`/api/v1/products/${created.body.data.id}`).set(auth).send(body).expect(422);
  }
  for (const field of ['minPrice', 'maxPrice']) await request(app).get(`/api/v1/products?${field}=2147483648`).expect(422);
  const latest = await prisma.product.findUniqueOrThrow({ where: { id: created.body.data.id } });
  expect(latest.price).toBe(2147483647); expect(latest.name).toBe('Valid product');
});
