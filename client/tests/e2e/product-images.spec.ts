import { test, expect, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const argon2 = require('../../../server/node_modules/argon2');
const database = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(database.pathname)) throw new Error('Image tests require an isolated database.');
database.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: database.toString() } } });
const productIds: string[] = [], userIds: string[] = [];
const password = 'ProductImagePassword123!';
const passwordHash = argon2.hash(password);
test.afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

async function unavailable(link: Locator, message: string) {
  await link.scrollIntoViewIfNeeded();
  await expect(link).toContainText(message);
  await expect(link.locator('img')).toHaveCount(0);
}

async function unavailablePreview(scope: Locator, name: string, message: string) {
  const placeholder = scope.getByRole('img', { name: `${name}: ${message}`, exact: true });
  // Firefox can defer off-screen image requests until they enter the viewport.
  // Scroll its persistent frame: the failed img itself is replaced on error.
  await placeholder.or(scope.getByRole('img', { name, exact: true })).locator('..').scrollIntoViewIfNeeded();
  await expect(placeholder).toBeVisible();
}

for (const language of ['en', 'fr']) test(`missing and failed product images have accessible fallbacks across cards (${language})`, async ({ page }) => {
  const category = `media-${crypto.randomUUID()}`;
  const products: { id: string; name: string }[] = [];
  for (const [name, picture] of [['Source', '/img/blue_hoody_1.jpeg'], ['Absent', null], ['Broken', `/img/missing-${crypto.randomUUID()}.jpeg`]] as const) {
    const product = await db.product.create({ data: { name: `${name} ${category}`, category, price: 10000, picture, sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock: 1 } } } });
    products.push(product); productIds.push(product.id);
  }
  const [source, absent, broken] = products;
  const message = language === 'fr' ? 'Image indisponible' : 'Image unavailable';
  await page.addInitScript(({ language, recent }) => {
    localStorage.setItem('preferred_language', language);
    localStorage.setItem('blessp_cookie_consent', 'accepted');
    localStorage.setItem('blessp_mfa_reminded_at', String(Date.now()));
    localStorage.setItem('recentlyViewed', JSON.stringify(recent));
  }, { language, recent: [absent.id, broken.id] });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/products/${source.id}`);
  const related = page.locator('section').filter({ has: page.getByRole('heading', { name: language === 'fr' ? 'Vous aimerez aussi' : 'You May Also Like', exact: true }) });
  for (const product of [absent, broken]) await unavailable(related.locator(`a[href="/products/${product.id}"]`), message);

  await page.goto(`/products/${broken.id}`);
  const gallery = page.getByRole('button').filter({ has: page.getByRole('img', { name: `${broken.name}: ${message}`, exact: true }) });
  await expect(gallery).toContainText(message);
  await gallery.click();
  await expect(page.getByRole('dialog')).toContainText(message);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto(`/shop?category=${encodeURIComponent(category)}`);
  for (const product of [absent, broken]) {
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) });
    await unavailable(card.locator(`a[href="/products/${product.id}"]`), message);
  }
  const recent = page.locator('section').filter({ has: page.getByRole('heading', { name: language === 'fr' ? 'Vus récemment' : 'Recently Viewed', exact: true }) });
  for (const product of [absent, broken]) await unavailable(recent.locator(`a[href="/products/${product.id}"]`), message);

  const user = await db.user.create({ data: { email: `media-${crypto.randomUUID()}@example.com`, passwordHash: await passwordHash, firstName: 'Media', lastName: 'Test', emailVerifiedAt: new Date() } });
  userIds.push(user.id);
  await db.wishlistItem.createMany({ data: [absent, broken].map(product => ({ userId: user.id, productId: product.id })) });
  expect((await page.request.post('/api/v1/auth/login', { data: { email: user.email, password } })).status()).toBe(200);
  await page.goto('/wishlist');
  for (const product of [absent, broken]) await unavailable(page.locator(`main a[href="/products/${product.id}"]`), message);
  const hovered = page.locator(`main a[href="/products/${absent.id}"]`);
  await hovered.hover();
  await expect(hovered.getByText(language === 'fr' ? 'Voir le produit' : 'View Product', { exact: true })).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await db.product.update({ where: { id: absent.id }, data: { picture: '/img/blue_hoody_1.jpeg' } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const recovered = page.locator(`main a[href="/products/${absent.id}"] img`);
  await recovered.scrollIntoViewIfNeeded();
  await expect.poll(() => recovered.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

for (const language of ['en', 'fr']) test(`missing media remains usable in search, comparison, cart, checkout and administration (${language})`, async ({ page }, info) => {
  const category = `media-${crypto.randomUUID()}`;
  const products: { id: string; name: string }[] = [];
  for (const [name, picture] of [['Absent', null], ['Broken', `/img/missing-${crypto.randomUUID()}.jpeg`]] as const) {
    const product = await db.product.create({ data: { name: `${name} ${category.slice(6, 14)}`, category, price: 10000, picture, images: picture ? [picture] : [], sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock: 2 } } } });
    products.push(product); productIds.push(product.id);
  }
  const message = language === 'fr' ? 'Image indisponible' : 'Image unavailable';
  await page.addInitScript(language => {
    localStorage.setItem('preferred_language', language);
    localStorage.setItem('blessp_cookie_consent', 'accepted');
    localStorage.setItem('blessp_mfa_reminded_at', String(Date.now()));
  }, language);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/shop?category=${encodeURIComponent(category)}`);
  for (const product of products) {
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: product.name, exact: true }) });
    await card.getByRole('button', { name: language === 'fr' ? 'Ajouter au comparateur' : 'Add to comparison', exact: true }).click();
    await expect(page.getByRole('img', { name: `${product.name}: ${message}`, exact: true }).last()).toBeVisible();
  }
  await page.goto('/compare');
  for (const product of products) await unavailable(page.locator(`main a[href="/products/${product.id}"]`).filter({ has: page.getByRole('img') }), message);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.getByRole('dialog');
  await search.getByRole('textbox').fill(category.slice(6, 14));
  for (const product of products) await expect(search.getByRole('img', { name: `${product.name}: ${message}`, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  for (const product of products) {
    await page.goto(`/products/${product.id}`);
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: language === 'fr' ? 'Ajouter au panier' : 'Add to Cart', exact: true }).first().click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('blessp_guest_cart') || '[]').length)).toBe(products.indexOf(product) + 1);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  for (const product of products) await expect(page.getByRole('dialog').getByRole('img', { name: `${product.name}: ${message}`, exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: language === 'fr' ? 'Passer au paiement' : 'Checkout', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const product of products) await unavailablePreview(page.locator('main'), product.name, message);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('missing-media-checkout.png'), fullPage: true });

  const user = await db.user.create({ data: { email: `media-admin-${crypto.randomUUID()}@example.com`, passwordHash: await passwordHash, firstName: 'Media', lastName: 'Admin', emailVerifiedAt: new Date(), isAdmin: true } });
  userIds.push(user.id);
  expect((await page.request.post('/api/v1/auth/login', { data: { email: user.email, password } })).status()).toBe(200);
  await page.goto(`/admin/products/${products[1].id}/edit`);
  await unavailablePreview(page.locator('main'), 'Product image 1', message);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1).catch(async error => {
    const overflow = await page.locator('main *').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => ({ tag: element.tagName, class: element.className, text: element.textContent?.slice(0, 100), right: element.getBoundingClientRect().right })));
    await info.attach('overflow-elements', { body: JSON.stringify(overflow, null, 2), contentType: 'application/json' });
    throw error;
  });
});
