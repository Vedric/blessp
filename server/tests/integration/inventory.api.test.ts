import request from 'supertest';
import crypto from 'node:crypto';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { createAdminUser, registerTestUser } from '../helpers/auth.helper';

beforeAll(setupTestDatabase);
afterEach(cleanDatabase);
afterAll(teardownTestDatabase);
const root = '/api/v1/admin/inventory';
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
async function fixture(stock = 10) {
  const admin = await createAdminUser();
  const product = await prisma.product.create({ data: { name: 'Inventory Hoodie', price: 5995, category: 'hoodies', sizes: ['M', 'L'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock, sku: 'INV-M' } } }, include: { variants: true } });
  return { admin, product, variant: product.variants[0], auth: bearer(admin.accessToken) };
}
const body = (expectedStock = 10, stock = 20) => ({ expectedStock, stock, reason: 'restock', note: 'Delivery checked', requestId: crypto.randomUUID() });

describe('Inventory HTTP contracts and concurrency', () => {
  it('restricts every endpoint to administrators', async () => {
    const { variant } = await fixture(); const user = await registerTestUser();
    for (const auth of [undefined, bearer(user.accessToken)]) {
      const status = auth ? 403 : 401;
      await request(app).get(root).set(auth ?? {}).expect(status);
      await request(app).get(`${root}/${variant.id}/history`).set(auth ?? {}).expect(status);
      await request(app).post(`${root}/${variant.id}/adjustments`).set(auth ?? {}).send(body()).expect(status);
    }
    expect(await prisma.stockAdjustment.count()).toBe(0);
  });
  it('filters available quantities, SKU and names, paginates stably and excludes deleted products', async () => {
    const { product, auth } = await fixture();
    await prisma.productVariant.create({ data: { productId: product.id, size: 'L', color: 'Black', stock: 2, sku: 'INV-L' } });
    await prisma.product.create({ data: { name: 'Empty stock', price: 100, category: 'hoodies', isActive: false, variants: { create: { stock: 0, size: '', color: '' } } } });
    await prisma.product.create({ data: { name: 'Unconfigured', price: 100, category: 'hoodies' } });
    await prisma.product.create({ data: { name: 'Deleted', price: 100, category: 'hoodies', deletedAt: new Date(), variants: { create: { stock: 100, size: '', color: '' } } } });
    const list = await request(app).get(`${root}?perPage=2`).set(auth).expect(200);
    expect(list.body.data).toMatchObject({ available: 12, unconfiguredProducts: 1, pagination: { totalItems: 3, totalPages: 2 } });
    expect(list.body.data.items.map((v: { stock: number }) => v.stock)).toEqual([0, 2]);
    expect(list.body.data.items[0].product.isActive).toBe(false);
    const second = await request(app).get(`${root}?perPage=2&page=2`).set(auth).expect(200);
    expect(second.body.data.items[0].stock).toBe(10);
    for (const [query, total, available] of [['status=low', 1, 2], ['status=out', 1, 0], ['status=available', 2, 12], ['search=inv-m', 1, 10], ['search=inventory', 2, 12], ['search=missing', 0, 0]] as const) {
      const res = await request(app).get(`${root}?${query}`).set(auth).expect(200);
      expect(res.body.data).toMatchObject({ available, pagination: { totalItems: total } });
    }
  });
  it('records actor, reason and before/after values without exposing request hashes', async () => {
    const { variant, auth, admin } = await fixture();
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body()).expect(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(20);
    const history = await request(app).get(`${root}/${variant.id}/history`).set(auth).expect(200);
    expect(history.body.data.items).toEqual([expect.objectContaining({ before: 10, after: 20, reason: 'restock', note: 'Delivery checked', actor: { firstName: admin.firstName, lastName: admin.lastName } })]);
    expect(history.body.data.items[0]).not.toHaveProperty('requestHash');
    expect(history.body.data.items[0]).not.toHaveProperty('requestId');
  });
  it('replays the same request exactly once and rejects reuse with changed details', async () => {
    const { variant, auth } = await fixture(); const payload = body();
    const [a, b] = await Promise.all([request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(payload), request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(payload)]);
    expect([a.status, b.status]).toEqual([200, 200]); expect(a.body.data.id).toBe(b.body.data.id);
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body(20, 15)).expect(200);
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(payload).expect(200);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(15);
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send({ ...payload, stock: 21 }).expect(409);
    expect(await prisma.stockAdjustment.count()).toBe(2);
  });
  it('rejects stale, unchanged and invalid adjustments without recording false history', async () => {
    const { variant, auth } = await fixture();
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body(9, 20)).expect(409);
    for (const payload of [body(10, 10), body(10, -1), body(10, 1.5), body(10, 1000001), { ...body(), reason: 'bogus' }, { ...body(), note: 'x'.repeat(501) }, { ...body(), requestId: 'invalid' }, { ...body(), actorId: crypto.randomUUID() }]) {
      await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(payload).expect(422);
    }
    expect(await prisma.stockAdjustment.count()).toBe(0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(10);
  });
  it('allows only one of two competing counts to win', async () => {
    const { variant, auth } = await fixture();
    const results = await Promise.all([20, 30].map(stock => request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body(10, stock))));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.stockAdjustment.count()).toBe(1);
    const ledger = await prisma.stockAdjustment.findFirstOrThrow();
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(ledger.after);
  });
  it('does not overwrite a concurrent order reservation', async () => {
    const { variant, product, auth } = await fixture(5);
    const [adjustment, order] = await Promise.all([
      request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body(5, 1)),
      request(app).post('/api/v1/orders/guest').send({ firstName: 'Inventory', lastName: 'Test', addressLine1: '1 Test Street', city: 'Montreal', postalCode: 'H2X1Y4', country: 'CA', email: 'inventory@example.com', checkoutKey: crypto.randomUUID(), items: [{ productId: product.id, size: 'M', color: 'Black', quantity: 2 }] }),
    ]);
    expect([[200, 422], [409, 201]]).toContainEqual([adjustment.status, order.status]);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(adjustment.status === 200 ? 1 : 3);
    expect(await prisma.stockAdjustment.count()).toBe(adjustment.status === 200 ? 1 : 0);
  });
  it('rolls back an entire editor batch if one stock value is stale', async () => {
    const { product, variant, auth } = await fixture();
    const other = await prisma.productVariant.create({ data: { productId: product.id, size: 'L', color: 'Black', stock: 5 } });
    await request(app).put(`/api/v1/admin/products/${product.id}/variants`).set(auth).send({ variants: [{ size: 'L', color: 'Black', stock: 8, expectedStock: 5 }, { size: 'M', color: 'Black', stock: 20, expectedStock: 9 }] }).expect(409);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: other.id } })).stock).toBe(5);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(10);
    expect(await prisma.stockAdjustment.count()).toBe(0);
  });
  it('requires an expected stock for existing variants and validates option combinations', async () => {
    const { product, auth } = await fixture(); const endpoint = `/api/v1/admin/products/${product.id}/variants`;
    await request(app).put(endpoint).set(auth).send({ variants: [{ size: 'M', color: 'Black', stock: 20 }] }).expect(409);
    await request(app).put(endpoint).set(auth).send({ variants: [{ size: 'XL', color: 'Black', stock: 20 }] }).expect(422);
    await request(app).put(endpoint).set(auth).send({ variants: [{ size: 'L', color: 'Black', stock: 20 }, { size: 'L', color: 'Black', stock: 30 }] }).expect(422);
    expect(await prisma.stockAdjustment.count()).toBe(0);
  });
  it('records initial and editor adjustments, with no invented baseline history', async () => {
    const { product, variant, auth } = await fixture();
    expect((await request(app).get(`${root}/${variant.id}/history`).set(auth).expect(200)).body.data.items).toEqual([]);
    await request(app).put(`/api/v1/admin/products/${product.id}/variants`).set(auth).send({ variants: [{ size: 'M', color: 'Black', stock: 12, expectedStock: 10 }, { size: 'L', color: 'Black', stock: 5 }] }).expect(200);
    const entries = await prisma.stockAdjustment.findMany({ orderBy: { reason: 'asc' } });
    expect(entries.map(e => [e.reason, e.before, e.after])).toEqual([['editor', 10, 12], ['initial', 0, 5]]);
  });
  it('bounds pagination and identifiers, and rejects deleted or missing variants', async () => {
    const { product, variant, auth } = await fixture();
    for (const query of ['page=0', 'perPage=101', 'status=invalid', `search=${'x'.repeat(101)}`]) await request(app).get(`${root}?${query}`).set(auth).expect(422);
    await request(app).get(`${root}/invalid/history`).set(auth).expect(422);
    await request(app).get(`${root}/${variant.id}/history?page=-1`).set(auth).expect(422);
    await request(app).get(`${root}/${crypto.randomUUID()}/history`).set(auth).expect(404);
    await prisma.product.update({ where: { id: product.id }, data: { deletedAt: new Date() } });
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body()).expect(404);
    await request(app).get(`${root}/${variant.id}/history`).set(auth).expect(404);
  });
  it('paginates history and retains snapshots after a variant or actor is deleted', async () => {
    const { variant, admin, auth } = await fixture();
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body()).expect(200);
    await request(app).post(`${root}/${variant.id}/adjustments`).set(auth).send(body(20, 30)).expect(200);
    const res = await request(app).get(`${root}/${variant.id}/history?perPage=1&page=2`).set(auth).expect(200);
    expect(res.body.data.pagination.totalItems).toBe(2); expect(res.body.data.items[0]).toMatchObject({ before: 10, after: 20 });
    await prisma.productVariant.delete({ where: { id: variant.id } });
    await prisma.user.delete({ where: { id: admin.id } });
    const entries = await prisma.stockAdjustment.findMany(); expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ variantId: null, actorId: null, productName: 'Inventory Hoodie', size: 'M', color: 'Black' });
  });
});
