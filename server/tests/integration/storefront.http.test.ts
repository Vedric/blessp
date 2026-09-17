import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { storefrontRouter } from '../../src/core/storefront/router';
import { Env } from '../../src/core/config/env';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blessp-html-test-'));
fs.writeFileSync(path.join(directory, 'index.html'), fs.readFileSync(path.resolve(__dirname, '../../../client/index.html'), 'utf8'));
// Use the real HTML template; no React/JavaScript execution in these HTTP tests.
const app = express();
app.use(storefrontRouter(directory));
app.use((_req, res) => res.sendStatus(404));
const origin = new URL(Env.CLIENT_URL).origin;
beforeAll(setupTestDatabase);
afterEach(cleanDatabase);
afterAll(async () => { await teardownTestDatabase(); fs.rmSync(directory, { recursive: true, force: true }); });
async function product(data = {}) {
  return prisma.product.create({ data: { name: 'Public hoodie', price: 5995, description: 'Premium cotton & comfort', picture: '/img/black_hoody_1.jpeg', ...data } });
}

it('sends product-specific title, description, price and absolute sharing URLs before JavaScript', async () => {
  const item = await product();
  const res = await request(app).get(`/products/${item.id}?utm_campaign=test`).set('Host', 'attacker.example').set('X-Forwarded-Host', 'attacker.example').expect(200);
  expect(res.text).toContain('<title>Public hoodie — BLE$$ P</title>');
  expect(res.text).toContain(`rel="canonical" href="${origin}/products/${item.id}"`);
  expect(res.text).toContain('property="product:price:amount" content="59.95"');
  expect(res.text).toContain(`property="og:image" content="${origin}/img/black_hoody_1.jpeg"`);
  expect(res.text.match(/property="og:title"/g)).toHaveLength(1);
  expect(res.text).not.toContain('attacker.example');
  expect(res.headers['x-robots-tag']).toBe('index, follow');
  expect(res.headers['cache-control']).toBe('no-cache');
});

it('escapes database content and rejects non-HTTP image URLs in metadata', async () => {
  const item = await product({ name: '"></title><script>alert(1)</script> $$ $&', description: '" onload="bad', picture: 'javascript:alert(1)' });
  const res = await request(app).get(`/products/${item.id}`).expect(200);
  expect(res.text).not.toContain('<script>alert(1)</script>');
  expect(res.text).not.toContain('javascript:alert');
  expect(res.text).toContain('&lt;script&gt;');
  expect(res.text).toContain('$$ $&amp;');
  expect(res.text).toContain(`content="${origin}/img/blessp_story.jpeg"`);
});

it.each([{ isActive: false }, { deletedAt: new Date() }])('never reveals unavailable products: %j', async (data) => {
  const item = await product(data);
  const res = await request(app).get(`/products/${item.id}`).expect(404);
  expect(res.text).not.toContain(item.name);
  expect(res.headers['x-robots-tag']).toBe('noindex, follow');
});

it.each(['/products/not-an-id', `/products/${crypto.randomUUID()}`, '/unknown-page', '/profile/nonexistent', '/admin/products/missing'])('returns a real HTML 404 for %s', async (route) => {
  const res = await request(app).get(route).expect(404).expect('Content-Type', /html/);
  expect(res.headers['x-robots-tag']).toBe('noindex, follow');
});

it('serves public HTML, preserves HEAD semantics and canonicalizes the index path', async () => {
  const home = await request(app).get('/').expect(200);
  const shop = await request(app).get('/shop').expect(200);
  expect(home.text).toContain('<title>BLE$$ P — Luxury Streetwear</title>');
  expect(shop.text).toContain('<title>Collection — BLE$$ P</title>');
  await request(app).head('/').expect(200).expect('Content-Type', /html/);
  await request(app).get('/index.html').expect(308).expect('Location', '/');
});

it.each(['/signin', '/signup', '/profile', '/checkout', '/admin/products/new', '/admin/inventory', '/admin/inventory/', '/admin/contact', '/admin/contact/', '/verify-email', '/order-status'])('keeps private or transactional page %s out of search indexes', async (route) => {
  const res = await request(app).get(route).expect(200);
  expect(res.headers['x-robots-tag']).toBe('noindex, follow');
  expect(res.text).toContain('name="robots" content="noindex, follow"');
});

it('keeps pagination canonical but strips tracking and excludes search/filter duplicates', async () => {
  const paginated = await request(app).get('/shop?page=2&utm_source=test').expect(200);
  expect(paginated.text).toContain(`rel="canonical" href="${origin}/shop?page=2"`);
  expect(paginated.headers['x-robots-tag']).toBe('index, follow');
  expect((await request(app).get('/shop?category=hoodies')).headers['x-robots-tag']).toBe('noindex, follow');
  const unusual = await request(app).get('//attacker/').expect(404);
  expect(unusual.text).toContain(`href="${origin}//attacker"`);
});

it('generates robots and paginated sitemaps for the configured origin and only active products', async () => {
  const visible = await product(); await product({ isActive: false }); await product({ deletedAt: new Date() });
  const robots = await request(app).get('/robots.txt').expect(200);
  expect(robots.text).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(robots.text).not.toContain('Disallow: /signin'); // Allow crawlers to read noindex.
  const index = await request(app).get('/sitemap.xml').expect(200);
  expect(index.text).toContain(`${origin}/sitemaps/products-1.xml`);
  const catalogue = await request(app).get('/sitemaps/products-1.xml').expect(200);
  expect(catalogue.text.match(/<url>/g)).toHaveLength(1);
  expect(catalogue.text).toContain(visible.id);
  const pages = await request(app).get('/sitemaps/pages.xml').expect(200);
  expect(pages.text).toContain(`${origin}/shop`);
  expect(pages.text).not.toContain('/profile');
  await request(app).get('/sitemaps/products-2.xml').expect(404);
  await request(app).get('/sitemaps/products-99999999999.xml').expect(404);
});

it('splits large catalogues instead of silently dropping URLs or exceeding sitemap limits', async () => {
  await prisma.product.createMany({ data: Array.from({ length: 1001 }, (_, i) => ({ name: `Item ${i}`, price: 1000 })) });
  const index = await request(app).get('/sitemap.xml').expect(200);
  expect(index.text).toContain('products-2.xml');
  const second = await request(app).get('/sitemaps/products-2.xml').expect(200);
  expect(second.text.match(/<url>/g)).toHaveLength(1);
});
