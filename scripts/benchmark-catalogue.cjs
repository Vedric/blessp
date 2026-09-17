// Compare the former Node aggregation with the repository on synthetic data.
// The unique schema is removed in finally; no existing catalogue is changed.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('../server/node_modules/@prisma/client');
const url = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV !== 'test' || !/_(test|audit|ci)$/.test(url.pathname) || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Requires an isolated local test database');
const schema = `performance_${process.pid}`;
url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
const output = process.argv[2];
if (!output) throw new Error('Pass an output JSON path');
const bootstrap = new PrismaClient();
const { prisma } = require('../server/dist/core/database/client');
const { ProductsRepository } = require('../server/dist/features/products/products.repository');
const repository = new ProductsRepository();
async function previousFilters() {
  const products = await prisma.product.findMany({ where: { deletedAt: null, isActive: true }, select: { category: true, colors: true, sizes: true, price: true } });
  const prices = products.map(p => p.price);
  return { categories: [...new Set(products.map(p => p.category).filter(Boolean))], colors: [...new Set(products.flatMap(p => p.colors))], sizes: [...new Set(products.flatMap(p => p.sizes))], priceRange: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 } };
}
const normalized = value => JSON.stringify({ ...value, categories: value.categories.sort(), colors: value.colors.sort(), sizes: value.sizes.sort() });
async function timed(fn) { const start = performance.now(); await fn(); return +(performance.now() - start).toFixed(2); }
(async () => {
  try {
    await bootstrap.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: path.resolve(__dirname, '../server'), env: process.env, stdio: 'pipe' });
    const count = 10000;
    for (let start = 0; start < count; start += 500) {
      await prisma.product.createMany({ data: Array.from({ length: 500 }, (_, offset) => ({ name: `Synthetic ${start + offset}`, category: ['hoodies', 'pants', 'sets'][offset % 3], price: 1000 + offset * 100, colors: [['Black', 'Blue'], ['Pink'], ['Black']][offset % 3], sizes: ['S', 'M', 'L', 'XL'] })) });
    }
    const before = await previousFilters();
    const after = await repository.findFilters();
    if (normalized(before) !== normalized(after)) throw new Error('Facet results differ');
    const times = { before: [], after: [] };
    // Alternate the order to reduce systematic warm-cache bias.
    for (let round = 0; round < 10; round++) {
      for (const key of round % 2 ? ['after', 'before'] : ['before', 'after']) times[key].push(await timed(key === 'before' ? previousFilters : () => repository.findFilters()));
    }
    const median = values => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return +(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2).toFixed(2);
    };
    const transferredProducts = await prisma.product.findMany({ select: { category: true, colors: true, sizes: true, price: true } });
    const report = { date: new Date().toISOString(), node: process.version, products: count, equivalentResults: true, runsMs: times, medianMs: { before: median(times.before), after: median(times.after) }, databaseRowsReturned: { before: count, after: 1 }, jsonRepresentationBytes: { before: Buffer.byteLength(JSON.stringify(transferredProducts)), after: Buffer.byteLength(JSON.stringify(after)) }, note: 'Local single-process repository benchmark, warm PostgreSQL cache, no Redis. JSON sizes describe the returned data, not wire traffic.' };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await prisma.$disconnect();
    await bootstrap.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await bootstrap.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
