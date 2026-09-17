import request from 'supertest';
import crypto from 'node:crypto';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { registerTestUser, createAdminUser } from '../helpers/auth.helper';
import { AuthRepository } from '../../src/features/auth/auth.repository';
import { PaymentsService } from '../../src/features/payments/payments.service';
import { drainEmailOutbox, enqueueEmail } from '../../src/core/email/outbox';
import { emailService } from '../../src/core/email/email.service';
import { hashToken } from '../../src/core/security/secrets';
import { Env } from '../../src/core/config/env';

beforeAll(setupTestDatabase);
afterEach(async () => { jest.restoreAllMocks(); await cleanDatabase(); });
afterAll(teardownTestDatabase);
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const shipping = { firstName: 'Marie', lastName: 'Test', addressLine1: '1 Rue Test', city: 'Montreal', postalCode: 'H2X1Y4', country: 'CA' };
async function product() { return prisma.product.create({ data: { name: 'API test', price: 5995, category: 'Hoodies', sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock: 20 } } } }); }
async function guestOrder() {
  const p = await product();
  const res = await request(app).post('/api/v1/orders/guest').send({ ...shipping, email: 'guest@example.com', checkoutKey: crypto.randomUUID(), billingAddress: { ...shipping, city: 'Paris', country: 'FR' }, items: [{ productId: p.id, size: 'M', color: 'Black', quantity: 1 }] }).expect(201);
  return res.body.data;
}

describe('Customer and administrator HTTP contracts', () => {
  it('supports wishlist lifecycle without leaking another customer’s list', async () => {
    const [user, other] = await Promise.all([registerTestUser(), registerTestUser()]); const p = await product();
    await request(app).post('/api/v1/wishlist').set(bearer(user.accessToken)).send({ productId: p.id }).expect(200);
    const list = await request(app).get('/api/v1/wishlist').set(bearer(user.accessToken)).expect(200);
    expect(JSON.stringify(list.body.data)).toContain(p.id);
    const separate = await request(app).get('/api/v1/wishlist').set(bearer(other.accessToken)).expect(200);
    expect(JSON.stringify(separate.body.data)).not.toContain(p.id);
    await request(app).delete(`/api/v1/wishlist/${p.id}`).set(bearer(user.accessToken)).expect(204);
    expect(await prisma.wishlistItem.count()).toBe(0);
    await request(app).post('/api/v1/wishlist').set(bearer(user.accessToken)).send({ productId: crypto.randomUUID() }).expect(404);
  });
  it('creates, updates, summarizes and moderates reviews with ownership enforcement', async () => {
    const [user, other, admin] = await Promise.all([registerTestUser(), registerTestUser(), createAdminUser()]); const p = await product();
    const empty = await request(app).get(`/api/v1/reviews/summary/${p.id}`).expect(200); expect(empty.body.data.totalReviews).toBe(0);
    const review = await request(app).post('/api/v1/reviews').set(bearer(user.accessToken)).send({ productId: p.id, rating: 4, title: 'Good', comment: '<script>inert text</script>' }).expect(201);
    const id = review.body.data.id;
    await request(app).post('/api/v1/reviews').set(bearer(user.accessToken)).send({ productId: p.id, rating: 3 }).expect(409);
    await request(app).patch(`/api/v1/reviews/${id}`).set(bearer(other.accessToken)).send({ rating: 1 }).expect(403);
    await request(app).delete(`/api/v1/reviews/${id}`).set(bearer(other.accessToken)).expect(403);
    await request(app).patch(`/api/v1/reviews/${id}`).set(bearer(user.accessToken)).send({ rating: 5, title: 'Updated', comment: 'Still good' }).expect(200);
    const summary = await request(app).get(`/api/v1/reviews/summary/${p.id}`).expect(200); expect(summary.body.data.averageRating).toBe(5);
    const list = await request(app).get(`/api/v1/reviews?productId=${p.id}`).expect(200); expect(list.body.pagination.totalItems).toBe(1);
    await request(app).get('/api/v1/reviews/admin/all').set(bearer(user.accessToken)).expect(403);
    const adminList = await request(app).get('/api/v1/reviews/admin/all?page=1&perPage=5&rating=5').set(bearer(admin.accessToken)).expect(200);
    expect(adminList.body.data).toEqual([expect.objectContaining({ id, productId: p.id, productName: p.name, rating: 5 })]);
    const filtered = await request(app).get('/api/v1/reviews/admin/all?rating=1').set(bearer(admin.accessToken)).expect(200);
    expect(filtered.body.data).toEqual([]); expect(filtered.body.pagination.totalItems).toBe(0);
    await request(app).get('/api/v1/reviews/admin/all?rating=6').set(bearer(admin.accessToken)).expect(422);
    await request(app).delete(`/api/v1/reviews/admin/${id}`).set(bearer(admin.accessToken)).expect(204);
    const own = await request(app).post('/api/v1/reviews').set(bearer(user.accessToken)).send({ productId: p.id, rating: 3 }).expect(201);
    await request(app).delete(`/api/v1/reviews/${own.body.data.id}`).set(bearer(user.accessToken)).expect(204);
  });
  it('admin coupons enforce percentage bounds, uniqueness, expiry and deactivation', async () => {
    const admin = await createAdminUser();
    await request(app).post('/api/v1/coupons').set(bearer(admin.accessToken)).send({ code: 'BAD', discountType: 'percentage', discountValue: 101 }).expect(422);
    const created = await request(app).post('/api/v1/coupons').set(bearer(admin.accessToken)).send({ code: 'Ten', discountType: 'percentage', discountValue: 10, minOrderCents: 1000, maxUses: 2, expiresAt: new Date(Date.now() + 86400000).toISOString() }).expect(201);
    const id = created.body.data.id;
    await request(app).post('/api/v1/coupons').set(bearer(admin.accessToken)).send({ code: 'TEN', discountType: 'fixed', discountValue: 50 }).expect(409);
    await request(app).get('/api/v1/coupons').set(bearer(admin.accessToken)).expect(200);
    const preview = await request(app).post('/api/v1/coupons/apply').send({ code: 'TEN', orderTotalCents: 5000 }).expect(200); expect(preview.body.data.discountCents).toBe(500);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id } })).currentUses).toBe(0);
    await request(app).patch(`/api/v1/coupons/${id}`).set(bearer(admin.accessToken)).send({ isActive: false, maxUses: null, expiresAt: null }).expect(200);
    await request(app).post('/api/v1/coupons/validate').send({ code: 'TEN', orderTotalCents: 5000 }).expect(422);
  });
  it('admin variant edits update actual available inventory and reject negative stock', async () => {
    const admin = await createAdminUser(); const p = await product();
    await prisma.product.update({ where: { id: p.id }, data: { sizes: ['M', 'L'] } });
    await request(app).put(`/api/v1/admin/products/${p.id}/variants`).set(bearer(admin.accessToken)).send({ variants: [{ size: 'M', color: 'Black', stock: -1 }] }).expect(422);
    await request(app).put(`/api/v1/admin/products/${p.id}/variants`).set(bearer(admin.accessToken)).send({ variants: [{ size: 'M', color: 'Black', stock: 2, expectedStock: 20, sku: 'SKU1' }, { size: 'L', color: 'Black', stock: 1 }] }).expect(200);
    const variants = await request(app).get(`/api/v1/products/${p.id}/variants`).expect(200); expect(variants.body.data).toHaveLength(2);
    await request(app).get(`/api/v1/products/${p.id}/complete-look`).expect(200);
    await request(app).get('/api/v1/products?colors=Black&sizes=M&minPrice=100&maxPrice=10000&sort=-price').expect(200);
    await request(app).patch(`/api/v1/admin/products/${p.id}`).set(bearer(admin.accessToken)).send({ name: 'Updated', picture: '/images/hoodie.jpg', isActive: false }).expect(200);
    await request(app).get(`/api/v1/products/${p.id}`).expect(404);
    await request(app).get(`/api/v1/admin/products/${p.id}`).set(bearer(admin.accessToken)).expect(200);
    await request(app).delete(`/api/v1/admin/products/${p.id}`).set(bearer(admin.accessToken)).expect(204);
  });
  it('returns redeemable coupons and preserves them in paginated history', async () => {
    const user = await registerTestUser();
    await prisma.user.update({ where: { id: user.id }, data: { loyaltyPoints: 250 } });
    const balance = await request(app).get('/api/v1/loyalty/balance').set(bearer(user.accessToken)).expect(200); expect(balance.body.data.points).toBe(250);
    const redeemed = await request(app).post('/api/v1/loyalty/redeem').set(bearer(user.accessToken)).send({ points: 200 }).expect(201);
    expect(redeemed.body.data.couponCode).toMatch(/^LOYALTY-/);
    const history = await request(app).get('/api/v1/loyalty/transactions?page=1&perPage=10').set(bearer(user.accessToken)).expect(200);
    expect(history.body.data[0].couponCode).toBe(redeemed.body.data.couponCode);
    await request(app).post('/api/v1/loyalty/redeem').set(bearer(user.accessToken)).send({ points: 100 }).expect(422);
  });
  it('allocates coupon discounts and refunds without counting shipping as product revenue', async () => {
    const admin = await createAdminUser(); const order = await guestOrder();
    await prisma.order.update({ where: { id: order.id }, data: { totalCents: 4990, discountCents: 2000, paymentStatus: 'partially_refunded', refundedCents: 1000 } });
    const result = await request(app).get('/api/v1/analytics/top-products').set(bearer(admin.accessToken)).expect(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].totalRevenueCents).toBe(Math.round(3995 * (1 - 1000 / 4990)));
  });
  it('reports net revenue and completed orders, with separate shipping and billing snapshots', async () => {
    const admin = await createAdminUser(); const order = await guestOrder();
    const unpaid = await request(app).get('/api/v1/analytics/overview').set(bearer(admin.accessToken)).expect(200); expect(unpaid.body.data.totalRevenueCents).toBe(0);
    await prisma.order.update({ where: { id: order.id }, data: { status: 'paid', paymentStatus: 'partially_refunded', refundedCents: 1000 } });
    const overview = await request(app).get('/api/v1/analytics/overview').set(bearer(admin.accessToken)).expect(200); expect(overview.body.data.totalRevenueCents).toBe(order.totalCents - 1000);
    for (const period of ['7d', '30d', '90d']) {
      const revenue = await request(app).get(`/api/v1/analytics/revenue?period=${period}`).set(bearer(admin.accessToken)).expect(200); expect(JSON.stringify(revenue.body.data)).toContain(String(order.totalCents - 1000)); expect(revenue.body.data).toHaveLength(parseInt(period)); expect(revenue.body.data.at(-1).date).toBe(new Date().toISOString().slice(0, 10));
    }
    await request(app).get('/api/v1/analytics/revenue?period=bad').set(bearer(admin.accessToken)).expect(400);
    await request(app).get('/api/v1/analytics/top-products?limit=5').set(bearer(admin.accessToken)).expect(200);
    await request(app).get('/api/v1/analytics/recent-orders?limit=5').set(bearer(admin.accessToken)).expect(200);
    const lookup = await request(app).post('/api/v1/orders/guest/lookup').send({ orderNumber: order.orderNumber, email: 'guest@example.com' }).expect(200);
    expect(lookup.body.data.shippingAddress.city).toBe('Montreal'); expect(lookup.body.data.billingAddress.city).toBe('Paris');
    await request(app).post('/api/v1/orders/guest/lookup').send({ orderNumber: order.orderNumber, email: 'wrong@example.com' }).expect(404);
    await request(app).get('/api/v1/orders?status=paid').set(bearer(admin.accessToken)).expect(200);
    await request(app).patch(`/api/v1/orders/${order.id}/status`).set(bearer(admin.accessToken)).send({ status: 'confirmed', note: 'Reviewed' }).expect(200);
    await request(app).get(`/api/v1/orders/${order.id}/timeline`).set(bearer(admin.accessToken)).expect(200);
  });
  it('consumes reset links once, revokes sessions, and rejects credentials verified before revocation', async () => {
    const user = await registerTestUser();
    await request(app).post('/api/v1/auth/forgot-password').send({ email: user.email }).expect(200);
    const outbox = await prisma.emailOutbox.findFirstOrThrow({ where: { payload: { path: ['subject'], equals: 'BLE$$ P: Reset Your Password' } } });
    const token = (outbox.payload as { html: string }).html.match(/token=([a-f0-9]{64})/)![1];
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/v1/auth/reset-password').send({ token, password: 'ResetPassword2!' })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    await request(app).get('/api/v1/auth/me').set(bearer(user.accessToken)).expect(401);
    await expect(new AuthRepository().createRefreshToken({ userId: user.id, token: 'stale', familyId: crypto.randomUUID(), sessionVersion: 0, expiresAt: new Date(Date.now() + 10000) })).rejects.toThrow(/security changed/);
    await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'ResetPassword2!' }).expect(200);
    await prisma.passwordResetToken.create({ data: { userId: user.id, token: hashToken('expired'), expiresAt: new Date(0) } });
    await request(app).post('/api/v1/auth/reset-password').send({ token: 'expired', password: 'ResetPassword3!' }).expect(401);
  });
  it('durably retries failed email delivery, clears delivered token bodies and avoids parallel claims', async () => {
    const send = jest.spyOn(emailService, 'send').mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValue(undefined);
    await prisma.$transaction((tx) => enqueueEmail(tx, { to: 'synthetic@example.com', subject: 'Test', html: '<p>synthetic token</p>' }, 'test-outbox'));
    await drainEmailOutbox();
    const failed = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: 'test-outbox' } }); expect(failed.processedAt).toBeNull(); expect(failed.attempts).toBe(1);
    await prisma.emailOutbox.update({ where: { id: failed.id }, data: { availableAt: new Date(0) } });
    await Promise.all([drainEmailOutbox(), drainEmailOutbox()]);
    expect(send).toHaveBeenCalledTimes(2);
    const delivered = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: failed.id } }); expect(delivered.processedAt).not.toBeNull(); expect(delivered.payload).toEqual({});
  });
  it('checks payment ownership before contacting Stripe and cancels through the public contract', async () => {
    const user = await registerTestUser(); const order = await guestOrder();
    const remote = { paymentIntents: { create: jest.fn().mockResolvedValue({ id: 'pi_http', client_secret: 'pi_http_secret', amount: order.totalCents, currency: 'cad' }), retrieve: jest.fn(), cancel: jest.fn().mockResolvedValue({}) } };
    jest.spyOn(PaymentsService.prototype as any, 'requireStripe').mockReturnValue(remote);
    await request(app).post('/api/v1/payments/create-intent').set(bearer(user.accessToken)).send({ orderId: order.id }).expect(403);
    await request(app).post('/api/v1/payments/guest-create-intent').send({ orderId: order.id, email: 'wrong@example.com' }).expect(403);
    await request(app).post('/api/v1/payments/guest-create-intent').send({ orderId: order.id, email: 'guest@example.com' }).expect(201);
    expect(remote.paymentIntents.create).toHaveBeenCalledTimes(1);
    await request(app).post('/api/v1/payments/cancel').send({ orderId: order.id, email: 'wrong@example.com' }).expect(403);
    remote.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_http', amount: order.totalCents, currency: 'cad', status: 'requires_payment_method' });
    await request(app).post('/api/v1/payments/cancel').send({ orderId: order.id, email: 'guest@example.com' }).expect(204);
    expect(remote.paymentIntents.cancel).toHaveBeenCalledTimes(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('cancelled');
  });
  it('keeps stock reserved on Stripe outages or mismatched reconciliation amounts', async () => {
    const order = await guestOrder(); await prisma.order.update({ where: { id: order.id }, data: { transactionKey: 'pi_http' } });
    const remote = { paymentIntents: { retrieve: jest.fn().mockRejectedValueOnce(new Error('Timeout')).mockResolvedValue({ id: 'pi_http', amount: 1, amount_received: 1, currency: 'cad', status: 'succeeded' }) } };
    jest.spyOn(PaymentsService.prototype as any, 'requireStripe').mockReturnValue(remote);
    await request(app).post('/api/v1/payments/cancel').send({ orderId: order.id, email: 'guest@example.com' }).expect(500);
    await request(app).post('/api/v1/payments/cancel').send({ orderId: order.id, email: 'guest@example.com' }).expect(422);
    const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } }); expect(current.stockReleasedAt).toBeNull(); expect(current.paymentStatus).toBe('pending');
  });
  it('exposes health, protects metrics, returns JSON errors and enforces request limits', async () => {
    await request(app).get('/health/live').expect(200); await request(app).get('/health/ready').expect(200);
    const previous = Env.METRICS_TOKEN; Env.METRICS_TOKEN = 'test-metrics-token-32-characters-minimum';
    try { const metrics = await request(app).get('/metrics').set(bearer(Env.METRICS_TOKEN)).expect(200); expect(metrics.text).toContain('http_requests_total'); } finally { Env.METRICS_TOKEN = previous; }
    await request(app).post('/api/v1/contact').send({ message: 'x'.repeat(1024 * 1024 + 1) }).expect(413);
    await request(app).get('/api/v1/not-found').expect('Content-Type', /json/).expect(404);
  });
});
