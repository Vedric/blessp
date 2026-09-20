import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const argon2 = require('../../../server/node_modules/argon2');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('UI fixtures require an isolated database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = 'InterfacePassword123!';
const hash = argon2.hash(password);
const shipping = { firstName: 'Interface', lastName: 'Test', addressLine1: '123 Test Street', city: 'Montreal', province: 'QC', postalCode: 'H2X 1Y4', country: 'CA' };
test.afterAll(async () => db.$disconnect());
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
});
async function member(admin = false) {
  return db.user.create({ data: { email: `interface-${crypto.randomUUID()}@example.com`, passwordHash: await hash, firstName: 'Interface', lastName: 'Test', emailVerifiedAt: new Date(), isAdmin: admin, loyaltyPoints: 200 } });
}
async function login(page: Page, email: string, secret = password) {
  await page.goto('/signin'); await page.locator('#email').fill(email); await page.locator('#password').fill(secret);
  const featured = page.waitForResponse(r => r.url().endsWith('/products/featured'));
  await page.locator('form').filter({ has: page.locator('#email') }).locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/signin/);
  await expect(page.locator('main h1')).toHaveText('BLE$$ P');
  await featured;
  // Finish the login landing page before auditing a different document; WebKit
  // reports requests interrupted by a full navigation as page errors.
  await page.waitForLoadState('networkidle');
}
async function catalogue() { return db.product.findFirstOrThrow({ where: { name: 'Classic Black Hoodie', isActive: true }, include: { variants: true } }); }
async function orderFor(user: { id: string }, status = 'paid') {
  return db.order.create({ data: { userId: user.id, orderNumber: `BLP-UI-${crypto.randomBytes(5).toString('hex').toUpperCase()}`, totalCents: 9094, shippingCents: 995, discountCents: 900, status, paymentStatus: 'paid', shippingAddress: shipping, items: { create: { productKey: 'ui-fixture', productName: 'Interface Hoodie', quantity: 1, unitPriceCents: 8999 } }, statusHistory: { create: { status } } } });
}
async function axe(page: Page) {
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) }));
}
async function inspectRoutes(page: Page, info: TestInfo, routes: string[]) {
  const findings: unknown[] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error' && /Unhandled React error/.test(message.text())) errors.push(message.text()); });
  page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  for (const route of routes) await test.step(route, async () => {
    if (route === '/checkout') {
      const p = await catalogue(); await page.goto(`/products/${p.id}`);
      await page.getByRole('button', { name: 'M', exact: true }).click();
      await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
      await expect(page.getByText(/added to cart/i).first()).toBeVisible();
    }
    const response = await page.goto(route); expect(response?.status()).toBe(route === '/unknown-ui-page' ? 404 : 200); await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(route.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?|$)'));
    await page.waitForLoadState('networkidle');
    // Exercise lazy loading and scroll-triggered animations before recording the full page.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) {
        scrollTo({ top: y, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 80));
      }
      scrollTo({ top: 0, behavior: 'instant' });
      await Promise.race([Promise.all(Array.from(document.images).filter(img => img.getBoundingClientRect().width > 0).map(img => img.decode().catch(() => undefined))), new Promise(resolve => setTimeout(resolve, 3000))]);
    });
    await page.waitForTimeout(700);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Something went wrong', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dev tools', exact: true })).toHaveCount(0);
    const brokenImages = await page.locator('img').evaluateAll(images => images.filter(img => img.getBoundingClientRect().width > 0 && (!img.complete || img.naturalWidth === 0)).map(img => img.getAttribute('src')));
    const screenshot = info.outputPath(`${route.replace(/[^a-z0-9]/gi, '_') || 'home'}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await info.attach(route, { path: screenshot, contentType: 'image/png' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const violations = await axe(page);
    const row = { route, status: response?.status(), overflow, brokenImages, violations };
    findings.push(row);
  });
  const report = info.outputPath('route-inspection.json');
  await fs.writeFile(report, JSON.stringify({ findings, errors }, null, 2));
  await info.attach('route-inspection.json', { path: report, contentType: 'application/json' });
  expect(errors).toEqual([]);
  expect(findings.filter((r: any) => r.status >= 500 || r.overflow > 1 || r.brokenImages.length || r.violations.length)).toEqual([]);
}
for (const width of [1440, 390]) {
  test(`public routes, images and accessibility at ${width}px`, async ({ page }, info) => {
    test.setTimeout(180000); await page.setViewportSize({ width, height: 900 }); const p = await catalogue();
    await inspectRoutes(page, info, ['/', '/shop', `/products/${p.id}`, '/search?q=Hoodie', '/compare', '/checkout', '/signin', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/newsletter/confirm', '/order-status', '/contact', '/terms', '/return-policy', '/privacy', '/legal-notice', '/unknown-ui-page']);
  });
  test(`member routes and accessibility at ${width}px`, async ({ page }, info) => {
    test.setTimeout(120000); await page.setViewportSize({ width, height: 900 }); const user = await member(); const order = await orderFor(user);
    await login(page, user.email);
    await inspectRoutes(page, info, ['/profile', '/profile/orders', `/profile/orders/${order.id}`, '/profile/addresses', '/profile/payment-methods', '/profile/email-preferences', '/profile/loyalty', '/wishlist']);
  });
  test(`admin routes and accessibility at ${width}px`, async ({ page }, info) => {
    test.setTimeout(120000); await page.setViewportSize({ width, height: 900 }); const user = await member(true); const p = await catalogue(); await orderFor(user);
    await db.review.create({ data: { userId: user.id, productId: p.id, rating: 4, title: 'Interface review', comment: 'A real browser inspection fixture.' } });
    await login(page, user.email);
    await inspectRoutes(page, info, ['/admin', '/admin/products', '/admin/products/new', `/admin/products/${p.id}/edit`, '/admin/orders', '/admin/reviews', '/admin/inventory', '/admin/contact']);
  });
}

test('profile fields are labelled and edits persist after reload', async ({ page }) => {
  const user = await member(); await login(page, user.email); await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('First Name', { exact: true }).fill('Updated');
  await page.getByLabel('Last Name', { exact: true }).fill('Customer');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updated Customer' })).toBeVisible(); await page.reload();
  await expect(page.getByRole('heading', { name: 'Updated Customer' })).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).firstName).toBe('Updated');
});

test('email preferences have named switches and persist changes', async ({ page }) => {
  const user = await member(); await login(page, user.email); await page.goto('/profile/email-preferences');
  await page.getByRole('switch', { name: 'Promotions', exact: true }).click();
  await page.getByRole('button', { name: 'Save Preferences' }).click();
  await expect(page.getByText('Preferences saved successfully.')).toBeVisible(); await page.reload();
  await expect(page.getByRole('switch', { name: 'Promotions', exact: true })).toBeChecked();
});

test('search clears obsolete results and follows URL changes', async ({ page }) => {
  await page.goto('/search?q=Hoodie'); const input = page.locator('main input[type=text]');
  await expect(page.locator('main').getByRole('link', { name: /Classic Black Hoodie/ })).toBeVisible();
  await input.fill(''); await expect(page).toHaveURL(/\/search$/);
  await expect(page.locator('main').getByRole('link', { name: /Classic Black Hoodie/ })).toHaveCount(0);
  await input.fill('Ocean'); await expect(page).toHaveURL(/q=Ocean/);
  await expect(page.locator('main').getByRole('link', { name: /Ocean Blue Hoodie/ })).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Rose'); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/q=Rose/); await expect(input).toHaveValue('Rose');
});

test('wishlist can be added, reloaded and removed through the interface', async ({ page }) => {
  const user = await member(); const p = await catalogue(); await login(page, user.email); await page.goto(`/products/${p.id}`);
  await page.getByRole('button', { name: 'Add to wishlist' }).first().click();
  await expect(page.getByRole('button', { name: 'Remove from wishlist' }).first()).toBeVisible();
  await page.goto('/wishlist'); await expect(page.getByRole('heading', { name: p.name })).toBeVisible(); await page.reload();
  await page.getByRole('button', { name: 'Remove from wishlist' }).click();
  await expect(page.getByRole('heading', { name: /wishlist is empty/i })).toBeVisible();
  expect(await db.wishlistItem.count({ where: { userId: user.id } })).toBe(0);
});

test('comparison of three products fits mobile and can be cleared', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 }); await page.goto('/shop');
  await page.getByRole('button', { name: 'Add to comparison' }).nth(0).click();
  await page.getByRole('button', { name: 'Add to comparison' }).nth(0).click();
  await page.getByRole('button', { name: 'Add to comparison' }).nth(0).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Compare Now' }).click();
  await expect(page.getByRole('heading', { name: 'Compare Products' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.locator('main').getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No products to compare' })).toBeVisible();
});

test('loyalty redemption produces a real coupon and consumes the correct balance', async ({ page }) => {
  const user = await member(); await login(page, user.email); await page.goto('/profile/loyalty');
  await page.getByRole('button', { name: 'Redeem Points', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Successfully redeemed 200 points');
  const coupon = await db.coupon.findFirstOrThrow({ where: { userId: user.id } });
  await expect(page.getByRole('status')).toContainText(coupon.code);
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).loyaltyPoints).toBe(0);
});
