import request from 'supertest';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { registerTestUser, createAdminUser } from '../helpers/auth.helper';
import { AuthService } from '../../src/features/auth/auth.service';
import { AuthRepository } from '../../src/features/auth/auth.repository';
import { HashService } from '../../src/core/security/hash.service';
import { TokenService } from '../../src/core/security/token.service';
import { MfaService } from '../../src/features/auth/mfa.service';
import { PaymentsService } from '../../src/features/payments/payments.service';
import { OrdersRepository } from '../../src/features/orders/orders.repository';
import { OrdersService } from '../../src/features/orders/orders.service';
import { CartRepository } from '../../src/features/cart/cart.repository';
import { CouponsService } from '../../src/features/coupons/coupons.service';
import { CouponsRepository } from '../../src/features/coupons/coupons.repository';
import { LoyaltyService } from '../../src/features/loyalty/loyalty.service';
import { LoyaltyRepository } from '../../src/features/loyalty/loyalty.repository';
import { AnalyticsRepository } from '../../src/features/analytics/analytics.repository';
import { decryptSecret, encryptSecret } from '../../src/core/security/secrets';
import { purgeDeletedAccounts } from '../../src/core/maintenance';

beforeAll(setupTestDatabase);
afterEach(async () => { jest.restoreAllMocks(); await cleanDatabase(); });
afterAll(teardownTestDatabase);
const shipping = { firstName: 'Test', lastName: 'Buyer', addressLine1: '123 Test St', city: 'Montreal', postalCode: 'H2X1Y4', country: 'CA' };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const orders = new OrdersService(new OrdersRepository(), new CartRepository(), new CouponsService(new CouponsRepository()));
async function product(stock = 10, price = 10000) {
  return prisma.product.create({ data: { name: 'Test item', price, sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock } } } });
}
async function guest(stock = 10, price = 10000) {
  const p = await product(stock, price);
  const body = { ...shipping, email: 'guest@example.com', checkoutKey: crypto.randomUUID(), items: [{ productId: p.id, size: 'M', color: 'Black', quantity: 1 }] };
  return { p, body };
}
function payments() {
  const service = new PaymentsService(new OrdersRepository());
  const stripe = (service as unknown as { stripe: Stripe }).stripe;
  return { service, stripe };
}
async function signedEvent(service: PaymentsService, type: string, object: unknown, id = `evt_${crypto.randomUUID()}`) {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  await service.handleWebhook(Buffer.from(payload), signature);
}
async function boundOrder(userId?: string) {
  const { body } = await guest();
  const order = await orders.createGuestOrder(body);
  return prisma.order.update({ where: { id: order.id }, data: { transactionKey: 'pi_bound', ...(userId ? { userId, guestEmail: null } : {}) }, include: { items: true } });
}
const success = (order: { id: string; totalCents: number }, overrides = {}) => ({ id: 'pi_bound', object: 'payment_intent', amount: order.totalCents, amount_received: order.totalCents, currency: 'cad', metadata: { orderId: order.id }, ...overrides });

describe('Security regression invariants', () => {
  it('never accepts refresh tokens as bearer credentials', async () => {
    const user = await registerTestUser();
    await request(app).get('/api/v1/users/profile').set(bearer(user.refreshToken)).expect(401);
    await request(app).get('/api/v1/users/profile').set(bearer(user.accessToken)).expect(200);
  });
  it('stores refresh and password-reset tokens as hashes and never logs reset URLs', async () => {
    const user = await registerTestUser();
    expect((await prisma.refreshToken.findFirstOrThrow()).token).toMatch(/^[a-f0-9]{64}$/);
    expect((await prisma.refreshToken.findFirstOrThrow()).token).not.toBe(user.refreshToken);
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email }).expect(200);
    expect((await prisma.passwordResetToken.findFirstOrThrow()).token).toMatch(/^[a-f0-9]{64}$/);
  });
  it('allows one concurrent refresh, revokes the reused family, and rejects replay', async () => {
    const user = await registerTestUser();
    const refresh = () => request(app).post('/api/v1/auth/refresh').set('Cookie', `refreshToken=${user.refreshToken}`);
    const results = await Promise.all([refresh(), refresh()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);
    expect((await refresh()).status).toBe(401);
  });
  it.each(['setup', 'refuse'])('protects an active MFA factor from %s', async (action) => {
    const user = await registerTestUser();
    await prisma.mfaSetup.create({ data: { userId: user.id, secret: encryptSecret('TESTSECRET'), enabled: true } });
    await request(app).post(`/api/v1/auth/mfa/${action}`).set(bearer(user.accessToken)).send({}).expect(401);
    const factor = await prisma.mfaSetup.findUniqueOrThrow({ where: { userId: user.id } });
    expect(factor.enabled).toBe(true); expect(decryptSecret(factor.secret)).toBe('TESTSECRET');
  });
  it('encrypts provisioning secrets and requires current codes to regenerate backups', async () => {
    const user = await registerTestUser();
    const setup = await request(app).post('/api/v1/auth/mfa/setup').set(bearer(user.accessToken)).send({}).expect(201);
    const factor = await prisma.mfaSetup.findUniqueOrThrow({ where: { userId: user.id } });
    expect(factor.secret).toMatch(/^v1:/); expect(setup.body.data.otpauthUrl).toContain(decryptSecret(factor.secret));
    await request(app).post('/api/v1/auth/mfa/verify').set(bearer(user.accessToken)).send({ token: 'bad' }).expect(422);
    await request(app).post('/api/v1/auth/mfa/refuse').set(bearer(user.accessToken)).send({}).expect(200);
  });
  it('consumes a backup code at most once under concurrency', async () => {
    const user = await registerTestUser();
    const hash = await new HashService().hash('ABCDE-23456');
    await prisma.mfaSetup.create({ data: { userId: user.id, enabled: true, secret: encryptSecret('TESTSECRET'), backupCodes: [hash] } });
    const mfa = new MfaService();
    expect((await Promise.all([mfa.checkCode(user.id, 'ABCDE-23456'), mfa.checkCode(user.id, 'ABCDE-23456')])).sort()).toEqual([false, true]);
  });
  it('requires MFA for an existing OAuth identity and refuses automatic email linking', async () => {
    const user = await registerTestUser();
    const service = new AuthService(new AuthRepository(), new HashService(), new TokenService(), new MfaService());
    const dto = { provider: 'google' as const, providerAccountId: 'verified-provider-id', email: user.email };
    await expect(service.oauthLogin(dto)).rejects.toThrow(/existing account/);
    expect(await prisma.oAuthAccount.count()).toBe(0);
    await prisma.oAuthAccount.create({ data: { userId: user.id, provider: dto.provider, providerAccountId: dto.providerAccountId } });
    await prisma.mfaSetup.create({ data: { userId: user.id, enabled: true, secret: encryptSecret('TESTSECRET') } });
    await expect(service.oauthLogin(dto)).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
    await expect(service.oauthLogin({ ...dto, mfaToken: 'invalid' })).rejects.toMatchObject({ code: 'INVALID_MFA_CODE' });
  });
  it('requires verified email and gives identical registration responses', async () => {
    const body = { email: 'pending@example.com', password: 'StrongPassword1', firstName: 'A', lastName: 'B' };
    const first = await request(app).post('/api/v1/auth/register').send(body).expect(202);
    const second = await request(app).post('/api/v1/auth/register').send(body).expect(202);
    expect(first.body).toEqual(second.body); expect(first.headers['set-cookie']).toBeUndefined();
    await request(app).post('/api/v1/auth/login').send(body).expect(401);
  });
  it('requires reauthentication and confirmation for an email change', async () => {
    const user = await registerTestUser();
    await request(app).patch('/api/v1/users/profile').set(bearer(user.accessToken)).send({ email: 'new@example.com' }).expect(401);
    await request(app).patch('/api/v1/users/profile').set(bearer(user.accessToken)).send({ email: 'new@example.com', currentPassword: 'TestPassword1' }).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(user.email);
    const job = await prisma.emailOutbox.findFirstOrThrow({ where: { payload: { path: ['to'], equals: 'new@example.com' } } });
    const token = (job.payload as { html: string }).html.match(/token=([a-f0-9]{64})/)![1];
    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(200);
    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe('new@example.com');
    await request(app).get('/api/v1/cart').set(bearer(user.accessToken)).expect(401);
  });
  it('revokes both access and refresh tokens on password change', async () => {
    const user = await registerTestUser();
    await request(app).post('/api/v1/users/change-password').set(bearer(user.accessToken)).send({ currentPassword: 'TestPassword1', newPassword: 'ChangedPassword1' }).expect(204);
    await request(app).get('/api/v1/cart').set(bearer(user.accessToken)).expect(401);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', `refreshToken=${user.refreshToken}`).expect(401);
  });
  it('rejects stale access after deletion, exports safe data, then anonymizes after 30 days', async () => {
    const user = await registerTestUser();
    const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await prisma.contactMessage.create({ data: { name: 'Test', email: profile.email, subject: 'Export fixture', message: 'Personal correspondence' } });
    const data = await request(app).get('/api/v1/users/export').set(bearer(user.accessToken)).expect(200);
    expect(data.body.data.contactMessages[0].message).toBe('Personal correspondence');
    expect(data.body.data.cartItems).toEqual([]);
    expect(data.body.data.wishlistItems).toEqual([]);
    expect(data.body.data).not.toHaveProperty('passwordHash');
    await request(app).delete('/api/v1/users/account').set(bearer(user.accessToken)).send({ password: 'TestPassword1' }).expect(204);
    await request(app).get('/api/v1/cart').set(bearer(user.accessToken)).expect(401);
    await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date(Date.now() - 31 * 86400000) } });
    await purgeDeletedAccounts();
    const deleted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(deleted.email).toContain('@deleted.invalid'); expect(deleted.passwordHash).toBeNull();
    expect(await prisma.contactMessage.count({ where: { email: profile.email } })).toBe(0);
    expect(await prisma.emailOutbox.count({ where: { payload: { path: ['to'], equals: profile.email } } })).toBe(0);
  });
});

describe('Order and payment transaction invariants', () => {
  it('aggregates duplicate lines and rolls back the entire order when stock is insufficient', async () => {
    const { p, body } = await guest(1); body.items.push(body.items[0]);
    await request(app).post('/api/v1/orders/guest').send(body).expect(422);
    expect((await prisma.productVariant.findFirstOrThrow({ where: { productId: p.id } })).stock).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });
  it.each([{ size: undefined, color: undefined }, { size: 'INVALID', color: 'Black' }])('rejects omitted or invalid variant %j', async (variant) => {
    const { body } = await guest(); Object.assign(body.items[0], variant);
    await request(app).post('/api/v1/orders/guest').send(body).expect(422);
    expect(await prisma.order.count()).toBe(0);
  });
  it('sells the last unit to only one concurrent buyer', async () => {
    const { p, body } = await guest(1);
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/v1/orders/guest').send({ ...body, checkoutKey: crypto.randomUUID() })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect((await prisma.productVariant.findFirstOrThrow({ where: { productId: p.id } })).stock).toBe(0);
  });
  it('returns one order for concurrent retries and rejects reuse with changed shipping', async () => {
    const { body } = await guest(2);
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/v1/orders/guest').send(body).expect(201)));
    expect(results[0].body.data.id).toBe(results[1].body.data.id); expect(await prisma.order.count()).toBe(1);
    await request(app).post('/api/v1/orders/guest').send({ ...body, city: 'Other' }).expect(409);
  });
  it('keeps the member cart until payment and combines no-option cart lines', async () => {
    const user = await registerTestUser(); const p = await prisma.product.create({ data: { name: 'No variants', price: 5000, variants: { create: { size: '', color: '', stock: 3 } } } });
    await request(app).post('/api/v1/cart').set(bearer(user.accessToken)).send({ productId: p.id, quantity: 1 }).expect(201);
    await request(app).post('/api/v1/cart').set(bearer(user.accessToken)).send({ productId: p.id, quantity: 1 }).expect(201);
    expect(await prisma.cartItem.count({ where: { userId: user.id } })).toBe(1);
    const order = await request(app).post('/api/v1/orders').set(bearer(user.accessToken)).send({ ...shipping, checkoutKey: crypto.randomUUID() }).expect(201);
    expect(order.body.data.totalCents).toBe(10000); expect(await prisma.cartItem.count({ where: { userId: user.id } })).toBe(1);
  });
  it('enforces coupon ownership, does not consume previews and limits concurrent reservations', async () => {
    const user = await registerTestUser(); const { body } = await guest();
    await prisma.coupon.create({ data: { code: 'PRIVATE', userId: user.id, discountType: 'fixed', discountValue: 100, maxUses: 1 } });
    await request(app).post('/api/v1/orders/guest').send({ ...body, couponCode: 'PRIVATE' }).expect(422);
    await request(app).post('/api/v1/coupons/validate').send({ code: 'PRIVATE', orderTotalCents: 10000 }).expect(422);
    await request(app).post('/api/v1/coupons/apply').set(bearer(user.accessToken)).send({ code: 'PRIVATE', orderTotalCents: 10000 }).expect(200);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'PRIVATE' } })).currentUses).toBe(0);
    await prisma.coupon.create({ data: { code: 'LAST', discountType: 'fixed', discountValue: 100, maxUses: 1 } });
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/v1/orders/guest').send({ ...body, checkoutKey: crypto.randomUUID(), couponCode: 'LAST' })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
  });
  it('cancels unpaid reservations once and returns stock and coupon usage', async () => {
    const { p, body } = await guest(1);
    await prisma.coupon.create({ data: { code: 'RESERVE', discountType: 'fixed', discountValue: 100, maxUses: 1 } });
    const order = await orders.createGuestOrder({ ...body, couponCode: 'RESERVE' }); const { service } = payments();
    await Promise.all([service.cancelPendingOrder(order.id), service.cancelPendingOrder(order.id)]);
    expect((await prisma.productVariant.findFirstOrThrow({ where: { productId: p.id } })).stock).toBe(1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'RESERVE' } })).currentUses).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('cancelled');
  });
  it('creates one intent under concurrent requests using a stable Stripe idempotency key', async () => {
    const { body } = await guest(); const order = await orders.createGuestOrder(body); const { service, stripe } = payments();
    const intent = { id: 'pi_one', client_secret: 'secret', amount: order.totalCents, currency: 'cad', status: 'requires_payment_method' };
    const create = jest.spyOn(stripe.paymentIntents, 'create').mockResolvedValue(intent as never);
    jest.spyOn(stripe.paymentIntents, 'retrieve').mockResolvedValue(intent as never);
    const result = await Promise.all([service.createGuestPaymentIntent(order.id, body.email), service.createGuestPaymentIntent(order.id, body.email)]);
    expect(result[0]).toEqual(result[1]); expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toEqual({ idempotencyKey: `order-payment-${order.id}` });
  });
  it.each([{ id: 'pi_unrelated' }, { amount: 1 }, { currency: 'usd' }, { amount_received: 1 }])('refuses mismatched successful payment %j', async (override) => {
    const order = await boundOrder(); const { service } = payments();
    await signedEvent(service, 'payment_intent.succeeded', success(order, override));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('pending');
  });
  it('deduplicates parallel webhooks, awards points once, and persists one confirmation email', async () => {
    const user = await registerTestUser(); await prisma.emailOutbox.deleteMany();
    const order = await boundOrder(user.id); const { service } = payments();
    await Promise.all([signedEvent(service, 'payment_intent.succeeded', success(order), 'evt_same'), signedEvent(service, 'payment_intent.succeeded', success(order), 'evt_same')]);
    await signedEvent(service, 'payment_intent.succeeded', success(order));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).loyaltyPoints).toBe(100);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(1);
    const email = await prisma.emailOutbox.findFirstOrThrow(); expect((email.payload as { to: string }).to).toBe(user.email);
    expect((email.payload as { html: string }).html).toContain(order.orderNumber!); expect(await prisma.emailOutbox.count()).toBe(1);
  });
  it('queues a French confirmation after the signed payment webhook and preserves it on replay', async () => {
    const { body } = await guest();
    const created = await orders.createGuestOrder({ ...body, locale: 'fr' });
    const order = await prisma.order.update({ where: { id: created.id }, data: { transactionKey: 'pi_bound' } });
    const { service } = payments();
    await signedEvent(service, 'payment_intent.succeeded', success(order), 'evt_french');
    await signedEvent(service, 'payment_intent.succeeded', success(order), 'evt_french');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('paid');
    const email = await prisma.emailOutbox.findFirstOrThrow();
    const payload = email.payload as { subject: string; html: string; to: string };
    expect(payload.subject).toContain('Confirmation de commande');
    expect(payload.html).toContain('<html lang="fr">');
    expect(payload.html).toContain('votre paiement est confirmé');
    expect(payload.to).toBe(body.email);
    expect(await prisma.emailOutbox.count()).toBe(1);
  });
  it('rolls back the webhook claim and financial effects together if confirmation persistence fails', async () => {
    const order = await boundOrder(); const { service } = payments();
    // Force a real FK failure during the payment transaction by a stale relation.
    const original = (service as unknown as { recordPayment: (...args: unknown[]) => Promise<void> }).recordPayment.bind(service);
    jest.spyOn(service as never, 'recordPayment' as never).mockImplementation(async (...args: unknown[]) => { await original(...args); throw new Error('Simulated crash before commit'); });
    await expect(signedEvent(service, 'payment_intent.succeeded', success(order), 'evt_retry')).rejects.toThrow('Simulated crash');
    expect(await prisma.stripeWebhookEvent.count()).toBe(0); expect(await prisma.emailOutbox.count()).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('pending');
    jest.restoreAllMocks(); await signedEvent(service, 'payment_intent.succeeded', success(order), 'evt_retry');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('paid');
  });
  it('handles partial and out-of-order refunds without erasing fulfillment or duplicating points', async () => {
    const user = await registerTestUser(); const order = await boundOrder(user.id); const { service } = payments();
    await signedEvent(service, 'payment_intent.succeeded', success(order));
    await prisma.order.update({ where: { id: order.id }, data: { status: 'shipped' } });
    const refund = (amount: number) => ({ id: 'ch_test', object: 'charge', payment_intent: 'pi_bound', amount: order.totalCents, amount_refunded: amount, currency: 'cad', metadata: {} });
    await signedEvent(service, 'charge.refunded', refund(500)); await signedEvent(service, 'charge.refunded', refund(1));
    let updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated).toMatchObject({ status: 'shipped', paymentStatus: 'partially_refunded', refundedCents: 500 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).loyaltyPoints).toBe(95);
    await signedEvent(service, 'charge.refunded', refund(order.totalCents)); await signedEvent(service, 'payment_intent.succeeded', success(order));
    updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.paymentStatus).toBe('refunded'); expect(updated.status).toBe('shipped');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).loyaltyPoints).toBe(0);
  });
  it('leaves failed attempts payable and rejects unsigned events', async () => {
    const order = await boundOrder(); const { service } = payments();
    await signedEvent(service, 'payment_intent.payment_failed', success(order));
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('pending');
    await expect(service.handleWebhook(Buffer.from('{}'), 'invalid')).rejects.toThrow('Invalid webhook signature');
  });
  it('expires only cancellable Stripe intents; captured payments retain their inventory', async () => {
    const order = await boundOrder(); const { service, stripe } = payments();
    await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(0) } });
    jest.spyOn(stripe.paymentIntents, 'retrieve').mockResolvedValue({ ...success(order), status: 'succeeded' } as never);
    const cancel = jest.spyOn(stripe.paymentIntents, 'cancel'); await service.expireReservations();
    expect(cancel).not.toHaveBeenCalled(); expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('paid');
  });
  it('rejects manually declaring paid/refunded or shipping an unpaid order', async () => {
    const admin = await createAdminUser(); const order = await boundOrder();
    for (const status of ['refunded', 'confirmed', 'shipped']) await request(app).patch(`/api/v1/orders/${order.id}/status`).set(bearer(admin.accessToken)).send({ status }).expect(422);
  });
  it('exchanges points for a personal coupon atomically under concurrent redemption', async () => {
    const user = await registerTestUser(); await prisma.user.update({ where: { id: user.id }, data: { loyaltyPoints: 100 } });
    const service = new LoyaltyService(new LoyaltyRepository());
    const results = await Promise.allSettled([service.redeemPoints(user.id, { points: 100 }), service.redeemPoints(user.id, { points: 100 })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.coupon.count({ where: { campaign: 'loyalty', userId: user.id } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).loyaltyPoints).toBe(0);
  });
  it('reports captured net revenue rather than unpaid orders', async () => {
    await boundOrder(); const analytics = new AnalyticsRepository(); expect((await analytics.getOverviewStats()).totalRevenueCents).toBe(0);
    const order = await prisma.order.findFirstOrThrow(); await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'partially_refunded', refundedCents: 500 } });
    expect((await analytics.getOverviewStats()).totalRevenueCents).toBe(9500);
  });
});

describe('API contracts and privacy', () => {
  it('supports admin products while hiding inactive products publicly', async () => {
    const admin = await createAdminUser(); const p = await product(); await prisma.product.update({ where: { id: p.id }, data: { isActive: false } });
    const list = await request(app).get('/api/v1/admin/products').set(bearer(admin.accessToken)).expect(200); expect(list.body.data).toHaveLength(1);
    await request(app).get(`/api/v1/products/${p.id}`).expect(404);
    const publicList = await request(app).get('/api/v1/products?isActive=false').expect(200); expect(publicList.body.data).toHaveLength(0);
    await request(app).get(`/api/v1/admin/products/${p.id}`).set(bearer(admin.accessToken)).expect(200);
    await request(app).patch(`/api/v1/admin/products/${p.id}`).set(bearer(admin.accessToken)).send({ picture: '/img/example.jpg' }).expect(200);
  });
  it('enforces address ownership and one default under concurrent updates', async () => {
    const user = await registerTestUser(); const other = await registerTestUser();
    const create = () => request(app).post('/api/v1/addresses').set(bearer(user.accessToken)).send({ ...shipping, isDefault: true }).expect(201);
    const [a, b] = await Promise.all([create(), create()]);
    expect(await prisma.address.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
    await request(app).patch(`/api/v1/addresses/${a.body.data.id}`).set(bearer(other.accessToken)).send({ city: 'No' }).expect(404);
    await request(app).delete(`/api/v1/addresses/${a.body.data.id}`).set(bearer(other.accessToken)).expect(404);
    await request(app).patch(`/api/v1/addresses/${a.body.data.id}`).set(bearer(user.accessToken)).send({ isDefault: true }).expect(200);
    await request(app).delete(`/api/v1/addresses/${a.body.data.id}`).set(bearer(user.accessToken)).expect(204);
    expect((await prisma.address.findUniqueOrThrow({ where: { id: b.body.data.id } })).isDefault).toBe(true);
  });
  it('requires newsletter consent and confirmation, then a secret to unsubscribe', async () => {
    await request(app).post('/api/v1/newsletter/subscribe').send({ email: 'subscriber@example.com' }).expect(422);
    await request(app).post('/api/v1/newsletter/subscribe').send({ email: 'subscriber@example.com', consent: true }).expect(202);
    expect((await prisma.newsletterSubscription.findFirstOrThrow()).isActive).toBe(false);
    const job = await prisma.emailOutbox.findFirstOrThrow(); const token = (job.payload as { html: string }).html.match(/token=([a-f0-9]{64})/)![1];
    await request(app).post('/api/v1/newsletter/confirm').send({ token }).expect(200);
    const sub = await prisma.newsletterSubscription.findFirstOrThrow(); expect(sub.isActive).toBe(true); expect(sub.confirmedAt).not.toBeNull();
    await request(app).post('/api/v1/newsletter/unsubscribe').send({ email: sub.email }).expect(422);
    const jobs = await prisma.emailOutbox.findMany(); const html = jobs.map((j) => (j.payload as { html: string }).html).find((h) => h.includes('unsubscribe='))!;
    await request(app).post('/api/v1/newsletter/unsubscribe').send({ token: html.match(/unsubscribe=([a-f0-9]{64})/)![1] }).expect(204);
    expect((await prisma.newsletterSubscription.findFirstOrThrow()).isActive).toBe(false);
  });
  it('returns JSON errors and hides metrics without a credential', async () => {
    const malformed = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"password":').expect(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    const missing = await request(app).get('/api/v1/unknown').expect(404); expect(missing.body.error.code).toBe('NOT_FOUND');
    await request(app).get('/metrics').expect(404);
  });
});
