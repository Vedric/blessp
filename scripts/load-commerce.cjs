// Local API load with real PostgreSQL transactions, synthetic data and no providers.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { once } = require('node:events');
const os = require('node:os');

let database;
try { database = new URL(process.env.DATABASE_URL || ''); }
catch { throw new Error('A local test DATABASE_URL is required.'); }
if (process.env.NODE_ENV !== 'test' || !/_(test|audit|ci)$/.test(database.pathname) || !['localhost', '127.0.0.1'].includes(database.hostname)) {
  throw new Error('Requires an isolated local test database via scripts/test-env.cjs.');
}
const output = process.argv[2];
if (!output) throw new Error('Provide a report JSON path.');
const schema = `load_${process.pid}_${Date.now()}`;
database.searchParams.set('schema', schema);
database.searchParams.set('connection_limit', '12');
process.env.DATABASE_URL = database.toString();
const { PrismaClient } = require('../server/node_modules/@prisma/client');
const bootstrap = new PrismaClient();
let prisma, server, schemaCreated = false, monitoring;
let peakRss = process.memoryUsage().rss;
const report = {
  date: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  environment: { node: process.version, platform: process.platform, cpus: os.availableParallelism(), databasePool: 12, products: 1000 },
  limitations: 'Local closed-loop API load. No Redis, proxy, external providers, browser rendering or production network. Rate limits are bypassed in test mode and tested separately. This is a regression check, not a hosting capacity promise.',
  phases: [], passed: false,
};
const stopping = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stopping.abort(new Error(`Interrupted by ${signal}`)));
const shipping = { firstName: 'Load', lastName: 'Buyer', addressLine1: '1 Synthetic Street', city: 'Montreal', province: 'QC', postalCode: 'H2X 1Y4', country: 'CA' };
function summarize(times, elapsed, statuses) {
  const sorted = [...times].sort((a, b) => a - b);
  const percentile = p => +(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] || 0).toFixed(2);
  return { requests: times.length, elapsedMs: +elapsed.toFixed(2), requestsPerSecond: +(times.length * 1000 / elapsed).toFixed(2), latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: percentile(1) }, statuses };
}
async function phase(name, concurrency, work) {
  const times = [], statuses = {};
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (route, body) => {
    stopping.signal.throwIfAborted();
    const start = performance.now();
    // A shared composite signal accumulates dependent signals at load-test scale.
    // Stop before each request; in-flight requests finish within their own timeout.
    const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    const data = response.status === 204 ? null : await response.json();
    times.push(performance.now() - start); statuses[response.status] = (statuses[response.status] || 0) + 1;
    return { status: response.status, data: data?.data ?? data };
  };
  const started = performance.now();
  // Wait for every worker before cleanup, including when one assertion fails.
  const results = await Promise.allSettled(Array.from({ length: concurrency }, (_, worker) => work(send, worker)));
  const metrics = { name, concurrency, ...summarize(times, performance.now() - started, statuses) };
  report.phases.push(metrics); console.log(JSON.stringify(metrics));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  stopping.signal.throwIfAborted();
  assert.ok(metrics.latencyMs.p95 < 2000, `${name}: local p95 regression budget exceeded (2000 ms)`);
}

(async () => {
  try {
    await bootstrap.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); schemaCreated = true;
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: path.join(__dirname, '../server'), env: process.env, stdio: 'pipe' });
    ({ prisma } = require('../server/dist/core/database/client'));
    const products = Array.from({ length: 1000 }, (_, i) => ({ id: randomUUID(), name: `Load product ${i}`, price: 2500 + i, category: i % 2 ? 'hoodies' : 'pants', colors: ['Black'], sizes: ['M'] }));
    await prisma.product.createMany({ data: products });
    await prisma.productVariant.createMany({ data: products.map(product => ({ productId: product.id, size: 'M', color: 'Black', stock: 1000 })) });
    const { createApp } = require('../server/dist/app');
    server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
    monitoring = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 250);
    for (const concurrency of [1, 8, 32, 64]) {
      const deadline = performance.now() + 15000;
      await phase('catalogue', concurrency, async (send, worker) => {
        let iteration = 0;
        while (performance.now() < deadline) {
          const product = products[(worker * 37 + iteration) % products.length];
          const routes = ['/api/v1/products?perPage=12&page=2', '/api/v1/products?category=hoodies&minPrice=2700&maxPrice=3000', `/api/v1/products/${product.id}`, `/api/v1/products/${product.id}/variants`, '/api/v1/products/filters', '/api/v1/commerce/config'];
          const result = await send(routes[iteration++ % routes.length]);
          assert.equal(result.status, 200); assert.ok(result.data);
        }
      });
    }
    await phase('checkout-and-cancel', 16, async (send, worker) => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const product = products[1 + worker];
        const body = { ...shipping, email: 'load@example.com', checkoutKey: randomUUID(), items: [{ productId: product.id, size: 'M', color: 'Black', quantity: 1 }] };
        const created = await send('/api/v1/orders/guest', body); assert.equal(created.status, 201);
        assert.equal(created.data.totalCents, product.price + 995);
        const replay = await send('/api/v1/orders/guest', body); assert.equal(replay.status, 201); assert.equal(replay.data.id, created.data.id);
        const cancelled = await send('/api/v1/payments/cancel', { orderId: created.data.id, email: body.email }); assert.equal(cancelled.status, 204);
      }
    });
    assert.equal(await prisma.order.count(), 192);
    assert.equal(await prisma.order.count({ where: { status: 'cancelled' } }), 192);
    assert.equal((await prisma.productVariant.aggregate({ _sum: { stock: true } }))._sum.stock, 1000000);

    const last = products[0];
    await prisma.productVariant.updateMany({ where: { productId: last.id }, data: { stock: 7 } });
    await phase('scarce-stock-burst', 64, async send => {
      const result = await send('/api/v1/orders/guest', { ...shipping, email: 'burst@example.com', checkoutKey: randomUUID(), items: [{ productId: last.id, size: 'M', color: 'Black', quantity: 1 }] });
      assert.ok([201, 422].includes(result.status), `Unexpected contention response ${result.status}`);
    });
    const burst = report.phases.at(-1);
    assert.deepEqual(burst.statuses, { 201: 7, 422: 57 });
    assert.equal((await prisma.productVariant.findFirstOrThrow({ where: { productId: last.id } })).stock, 0);
    assert.equal(await prisma.order.count({ where: { status: 'pending' } }), 7);
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/health/ready`)).status, 200);
    report.invariants = { cancelledOrders: 192, duplicateOrders: 0, burstOrders: 7, rejectedBuyers: 57, availableBurstStock: 0, readyAfterLoad: true };
    report.passed = true;
  } catch (error) {
    report.failure = error.message; process.exitCode = 1;
  } finally {
    clearInterval(monitoring);
    if (server) { const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closed; }
    if (prisma) await prisma.$disconnect();
    if (schemaCreated) await bootstrap.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await bootstrap.$disconnect();
    report.peakAppRssMiB = +(peakRss / 1024 / 1024).toFixed(1);
    report.cleanedUp = true;
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, failure: report.failure, report: output, cleanedUp: true }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
