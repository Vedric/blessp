import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Recommendation tests require an isolated database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const ids: string[] = [];
async function pair() {
  const color = `#${crypto.randomBytes(3).toString('hex')}`;
  const source = await db.product.create({ data: {
    name: `Pair Hoodie ${crypto.randomUUID().replaceAll('-', '')}`, category: 'hoodies', price: 10000,
    picture: '/img/blue_hoody_1.jpeg', colors: [color], sizes: ['S', 'M'],
    variants: { create: ['S', 'M'].map(size => ({ size, color, stock: 5 })) },
  } });
  ids.push(source.id);
  const suggested = await db.product.create({ data: {
    name: `Pair Pants ${crypto.randomUUID()}`, category: 'pants', price: 7000,
    picture: '/img/blue_pants_1.jpeg', colors: [color], sizes: ['S', 'M'],
    variants: { create: [{ size: 'S', color, stock: 0 }, { size: 'M', color, stock: 5 }] },
  } });
  ids.push(suggested.id);
  // A neighbouring catalogue entry must not expand the mobile related grid.
  const related = await db.product.create({ data: {
    name: `LongProductReference${crypto.randomBytes(24).toString('hex')}`, category: 'hoodies', price: 10000,
    picture: '/img/blue_hoody_1.jpeg', colors: ['White'], sizes: ['M'],
    variants: { create: { size: 'M', color: 'White', stock: 5 } },
  } });
  ids.push(related.id);
  return { source, suggested };
}
test.afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
for (const language of ['en', 'fr']) {
  test(`recommendations show the real price and require a chosen available variant (${language})`, async ({ page }) => {
    await page.addInitScript(language => {
      localStorage.setItem('preferred_language', language);
      localStorage.setItem('blessp_cookie_consent', 'rejected');
    }, language);
    if (language === 'fr') await page.setViewportSize({ width: 320, height: 740 });
    const { source, suggested } = await pair();
    await page.goto(`/products/${source.id}`);
    const recommendations = page.getByRole('region', { name: /Complete the Look|Complétez le look/ });
    await expect(recommendations.getByRole('article')).toHaveCount(1);
    await recommendations.scrollIntoViewIfNeeded();
    await expect(recommendations).toContainText('$70.00');
    await expect(recommendations).not.toContainText(/Save|Économisez|153\.00/);
    await expect(recommendations.getByRole('button')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('blessp_guest_cart'))).toBeNull();
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      elements: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 80), class: el.className, right: el.getBoundingClientRect().right })),
    }));
    expect(layout.overflow, JSON.stringify(layout.elements)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({ page }).include('section[aria-label]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await test.info().attach(`recommendations-${language}`, { body: await page.screenshot(), contentType: 'image/png' });
    await recommendations.getByRole('link', { name: new RegExp(`^(Choose options for|Choisir les options pour) ${suggested.name}$`) }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${suggested.id}$`));
    await expect(page.getByRole('button', { name: 'S', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: /^(Add to Cart|Ajouter au panier)$/i }).first().click();
    await expect(page.getByText(/added to cart|ajouté au panier/i).first()).toBeVisible();
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('blessp_guest_cart')!));
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ productId: suggested.id, size: 'M', quantity: 1, product: { price: 7000 } });
    await page.goto('/checkout');
    await expect(page.locator('main')).toContainText('$79.95');
    await expect(page.locator('main')).toContainText(suggested.name);
    await expect(page.locator('main')).not.toContainText(source.name);
  });
}

test('a recommendation outage leaves the product and its purchase flow usable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected');
  });
  const { source } = await pair();
  await page.route('**/complete-look', route => route.fulfill({ status: 503, json: { error: { message: 'Synthetic outage' } } }));
  await page.goto(`/products/${source.id}`);
  await expect(page.getByRole('heading', { name: source.name, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Complete the Look' })).toHaveCount(0);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
  await expect(page.getByText(/added to cart/i).first()).toBeVisible();
});
