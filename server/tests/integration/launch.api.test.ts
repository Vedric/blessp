import request from 'supertest';
import crypto from 'node:crypto';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { createAdminUser, registerTestUser } from '../helpers/auth.helper';
import { Env } from '../../src/core/config/env';
import * as outbox from '../../src/core/email/outbox';
import { emailService } from '../../src/core/email/email.service';
import { purgeDeletedAccounts } from '../../src/core/maintenance';
const originalRates = Env.SHIPPING_RATES_JSON;
const originalSupport = Env.SUPPORT_EMAIL;
beforeAll(setupTestDatabase);
afterEach(async () => { Env.SHIPPING_RATES_JSON = originalRates; Env.SUPPORT_EMAIL = originalSupport; jest.restoreAllMocks(); await cleanDatabase(); });
afterAll(teardownTestDatabase);
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const contact = { name: 'Launch Contact', email: 'contact@example.com', subject: 'Order support', message: 'Please help with my delivery and order.' };
async function product() { return prisma.product.create({ data: { name: 'Shipping Test', price: 5000, category: 'hoodies', sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock: 20 } } }, include: { variants: true } }); }
const address = { firstName: 'Test', lastName: 'Customer', addressLine1: '1 Test Street', city: 'Montreal', postalCode: 'H2X1Y4', country: 'CA' };
function orderBody(productId: string) { return { ...address, email: 'buyer@example.com', checkoutKey: crypto.randomUUID(), items: [{ productId, size: 'M', color: 'Black', quantity: 2 }] }; }

it('exposes only public shipping configuration, with no server secrets', async () => {
  Env.SHIPPING_RATES_JSON = [{ country: 'CA', feeCents: 750, freeThresholdCents: null }];
  const response = await request(app).get('/api/v1/commerce/config').expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.data).toEqual({ currency: 'CAD', shippingRates: Env.SHIPPING_RATES_JSON, payments: { paypal: false } });
});
it('rejects non-shipping countries without reserving stock or consuming a coupon', async () => {
  Env.SHIPPING_RATES_JSON = [{ country: 'CA', feeCents: 750, freeThresholdCents: 10000 }];
  const p = await product();
  await prisma.coupon.create({ data: { code: 'LAUNCH', discountType: 'fixed', discountValue: 100, maxUses: 1 } });
  await request(app).post('/api/v1/orders/guest').send({ ...orderBody(p.id), country: 'FR', couponCode: 'LAUNCH' }).expect(422);
  expect(await prisma.order.count()).toBe(0);
  expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock).toBe(20);
  expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'LAUNCH' } })).currentUses).toBe(0);
});
it('calculates shipping after discounts and permits a separate foreign billing country', async () => {
  Env.SHIPPING_RATES_JSON = [{ country: 'CA', feeCents: 750, freeThresholdCents: 10000 }];
  const p = await product();
  await prisma.coupon.create({ data: { code: 'LAUNCH', discountType: 'fixed', discountValue: 100 } });
  const body = { ...orderBody(p.id), couponCode: 'LAUNCH', locale: 'fr', billingAddress: { ...address, city: 'Paris', country: 'FR' } };
  const response = await request(app).post('/api/v1/orders/guest').send(body).expect(201);
  expect(response.body.data).toMatchObject({ shippingCents: 750, discountCents: 100, totalCents: 10650, billingAddress: { country: 'FR' } });
  expect((await prisma.order.findUniqueOrThrow({ where: { id: response.body.data.id } })).locale).toBe('fr');
  // Configuration changes do not rewrite an already-created order on idempotent replay.
  Env.SHIPPING_RATES_JSON = [{ country: 'US', feeCents: 2000, freeThresholdCents: null }];
  const replay = await request(app).post('/api/v1/orders/guest').send(body).expect(201);
  expect(replay.body.data).toMatchObject({ id: response.body.data.id, shippingCents: 750, totalCents: 10650 });
});
it('queues a contact notification to the configured inbox and retries transport failures', async () => {
  Env.SUPPORT_EMAIL = 'new-support@example.com';
  const send = jest.spyOn(emailService, 'send').mockRejectedValueOnce(new Error('Temporary provider failure')).mockResolvedValue(undefined);
  const response = await request(app).post('/api/v1/contact').send(contact).expect(201);
  expect(send).not.toHaveBeenCalled();
  const id = `contact:${response.body.data.id}`;
  const queued = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
  expect(queued.payload).toMatchObject({ to: 'new-support@example.com' });
  await outbox.drainEmailOutbox();
  const failed = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
  expect(failed.processedAt).toBeNull(); expect(failed.attempts).toBe(1);
  await prisma.emailOutbox.update({ where: { id }, data: { availableAt: new Date(0) } });
  await outbox.drainEmailOutbox();
  const delivered = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } }); expect(delivered.processedAt).not.toBeNull(); expect(delivered.payload).toEqual({});
  expect(send.mock.calls.map(call => call[0].idempotencyKey)).toEqual([id, id]);
});
it('rolls back a contact message if its notification cannot be persisted', async () => {
  jest.spyOn(outbox, 'enqueueEmail').mockRejectedValue(new Error('Outbox unavailable'));
  await request(app).post('/api/v1/contact').send(contact).expect(500);
  expect(await prisma.contactMessage.count()).toBe(0); expect(await prisma.emailOutbox.count()).toBe(0);
});
it('protects customer messages and read flags from ordinary and anonymous users', async () => {
  const user = await registerTestUser(); const message = await prisma.contactMessage.create({ data: contact });
  for (const auth of [undefined, bearer(user.accessToken)]) {
    await request(app).get('/api/v1/admin/contact').set(auth ?? {}).expect(auth ? 403 : 401);
    await request(app).patch(`/api/v1/admin/contact/${message.id}`).set(auth ?? {}).send({ read: true }).expect(auth ? 403 : 401);
  }
});
it('filters, paginates and marks messages read without sending a reply', async () => {
  const admin = await createAdminUser(); const auth = bearer(admin.accessToken);
  const a = await prisma.contactMessage.create({ data: contact });
  await prisma.contactMessage.create({ data: { ...contact, subject: 'Second question' } });
  const list = await request(app).get('/api/v1/admin/contact?perPage=1').set(auth).expect(200);
  expect(list.headers['cache-control']).toBe('no-store'); expect(list.body.data).toMatchObject({ unread: 2, pagination: { totalItems: 2, totalPages: 2 } });
  const first = await request(app).patch(`/api/v1/admin/contact/${a.id}`).set(auth).send({ read: true }).expect(200);
  const again = await request(app).patch(`/api/v1/admin/contact/${a.id}`).set(auth).send({ read: true }).expect(200);
  expect(again.body.data.readAt).toBe(first.body.data.readAt);
  const read = await request(app).get('/api/v1/admin/contact?status=read&search=order').set(auth).expect(200);
  expect(read.body.data.items).toHaveLength(1); expect(read.body.data.items[0].id).toBe(a.id);
  const sentBefore = await prisma.emailOutbox.count();
  await request(app).patch(`/api/v1/admin/contact/${a.id}`).set(auth).send({ read: false }).expect(200);
  expect(await prisma.emailOutbox.count()).toBe(sentBefore);
  await request(app).get('/api/v1/admin/contact?perPage=101').set(auth).expect(422);
  await request(app).patch(`/api/v1/admin/contact/${a.id}`).set(auth).send({ read: true, email: 'other@example.com' }).expect(422);
  await request(app).patch(`/api/v1/admin/contact/${crypto.randomUUID()}`).set(auth).send({ read: true }).expect(404);
});
it('removes the queued support copy when the customer account is anonymized', async () => {
  const user = await registerTestUser();
  const response = await request(app).post('/api/v1/contact').send({ ...contact, email: user.email }).expect(201);
  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(Date.now() - 31 * 86400000) } });
  await purgeDeletedAccounts();
  expect(await prisma.contactMessage.findUnique({ where: { id: response.body.data.id } })).toBeNull();
  expect(await prisma.emailOutbox.findUnique({ where: { id: `contact:${response.body.data.id}` } })).toBeNull();
});
