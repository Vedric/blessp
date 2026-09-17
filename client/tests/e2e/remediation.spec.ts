import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Browser fixtures require an isolated test database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = 'BrowserTestPassword123!';
test.afterAll(async () => { await db.$disconnect(); });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('preferred_language')) localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
});
async function register(request: APIRequestContext) {
  const email = `browser-${crypto.randomUUID()}@example.com`;
  const res = await request.post('/api/v1/auth/register', { data: { email, password, firstName: 'Browser', lastName: 'Test' } }); expect(res.status()).toBe(202);
  const row = await db.emailOutbox.findFirstOrThrow({ where: { payload: { path: ['to'], equals: email } } });
  const token = row.payload.html.match(/token=([a-f0-9]{64})/)[1];
  return { email, token };
}
async function signIn(page: Page, email: string, secret = password) {
  await page.goto('/signin'); await page.locator('#email').fill(email); await page.locator('#password').fill(secret);
  const form = page.locator('form').filter({ has: page.locator('#email') });
  await form.locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/signin/);
}
async function verified(request: APIRequestContext) { const user = await register(request); expect((await request.post('/api/v1/auth/verify-email', { data: { token: user.token } })).ok()).toBe(true); return user; }

test('email confirmation, sign-in, refresh-cookie bootstrap and sign-out survive reloads', async ({ page, request }) => {
  const user = await register(request);
  await page.goto(`/verify-email#token=${user.token}`);
  await page.getByRole('button', { name: /confirm my email/i }).click();
  await expect(page.getByText(/email verified/i)).toBeVisible();
  await signIn(page, user.email);
  await page.goto('/profile'); await expect(page.locator('main')).toContainText(user.email);
  await page.reload(); await expect(page).toHaveURL(/\/profile$/); await expect(page.locator('main')).toContainText(user.email);
  await page.getByRole('button', { name: /sign out/i }).first().click();
  await page.goto('/profile'); await expect(page).toHaveURL(/\/signin/);
});

test('saved addresses can be created through the form and reused at checkout', async ({ page, request }) => {
  const user = await verified(request); await signIn(page, user.email);
  await page.goto('/profile/addresses');
  await page.getByRole('button', { name: /add.*address/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /add.*address/i }).first().click();
  for (const [key, value] of Object.entries({ firstName: 'Browser', lastName: 'Test', addressLine1: '123 Browser Street', city: 'Montreal', postalCode: 'H2X 1Y4', province: 'QC' })) await page.locator(`#field-${key}`).fill(value);
  await page.locator('main form button[type=submit]').click();
  await expect(page.locator('main')).toContainText('123 Browser Street');
  const stored = await db.address.findMany({ where: { user: { email: user.email } } }); expect(stored).toHaveLength(1);
  await page.reload(); await expect(page.locator('main')).toContainText('123 Browser Street');
});

test('admin product creation persists stock and loads the product editor', async ({ page }) => {
  await signIn(page, 'e2e-admin@example.com', 'E2EAdminPassword123!');
  await page.goto('/admin/products/new');
  const name = `Browser product ${crypto.randomUUID()}`;
  await page.locator('#field-name').fill(name); await page.locator('#field-price').fill('59.95');
  await page.getByRole('spinbutton', { name: /^Stock/ }).fill('7');
  await page.locator('main form button[type=submit]').click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  const product = await db.product.findFirstOrThrow({ where: { name }, include: { variants: true } });
  expect(product.price).toBe(5995); expect(product.variants[0].stock).toBe(7);
  await page.goto(`/admin/products/${product.id}/edit`); await expect(page.locator('#field-name')).toHaveValue(name);
  await expect(page.getByRole('spinbutton', { name: /^Stock/ })).toHaveValue('7');
  await db.product.delete({ where: { id: product.id } }); // Keep repeated local runs from growing the catalogue.
});

test('member order list uses the authenticated endpoint and guest lookup verifies email', async ({ page, request }) => {
  const user = await verified(request); const member = await db.user.findUniqueOrThrow({ where: { email: user.email } });
  const number = `BLP-E2E-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  await db.order.create({ data: { userId: member.id, orderNumber: number, totalCents: 5995, status: 'paid', paymentStatus: 'paid', shippingAddress: {}, items: { create: { productKey: 'fixture', productName: 'Browser order item', quantity: 1, unitPriceCents: 5995 } } } });
  await signIn(page, user.email); await page.goto('/profile/orders'); await expect(page.locator('main')).toContainText(number);
  const guestNumber = `BLP-E2E-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  await db.order.create({ data: { guestEmail: 'lookup@example.com', orderNumber: guestNumber, totalCents: 5995, shippingAddress: {} } });
  await page.goto('/order-status'); await page.getByLabel('Order number').fill(guestNumber); await page.locator('main').getByLabel('Email', { exact: true }).fill('wrong@example.com'); await page.getByRole('button', { name: 'Look up order' }).click();
  await expect(page.getByRole('alert')).toContainText(/not found/);
  await page.locator('main').getByLabel('Email', { exact: true }).fill('lookup@example.com'); await page.getByRole('button', { name: 'Look up order' }).click();
  await expect(page.getByRole('heading', { level: 2, name: guestNumber })).toBeVisible();
});

test('payment context is restored after reload and URL parameters cannot fabricate success', async ({ page }) => {
  await page.goto('/shop');
  await page.evaluate(() => sessionStorage.setItem('blessp_checkout_pending', JSON.stringify({ savedAt: Date.now(), userId: null, clientSecret: 'pi_browser_secret_synthetic', orderId: '00000000-0000-4000-8000-000000000001', orderNumber: 'BLP-BROWSER-PENDING', guestEmail: 'guest@example.com', shipping: { firstName: 'Browser', lastName: 'Test', addressLine1: '123 Pending St', city: 'Montreal', province: 'QC', postalCode: 'H2X', country: 'CA' }, items: [], subtotal: 5995, shippingCents: 995, discount: 0, total: 6990 })));
  await page.goto('/checkout?redirect_status=succeeded'); await expect(page).toHaveURL(/\/checkout/);
  await expect(page.locator('main')).toContainText('123 Pending St');
  await expect(page.getByRole('heading', { name: /thank you|order confirmed/i })).toHaveCount(0);
  await page.reload(); await expect(page.locator('main')).toContainText('123 Pending St');
  expect(await page.evaluate(() => Boolean(sessionStorage.getItem('blessp_checkout_pending')))).toBe(true);
});

for (const width of [360, 390, 768]) test(`shop remains within the viewport at ${width}px and filter focus returns on Escape`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await page.goto('/shop'); await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  const filters = page.getByRole('button', { name: /^filters/i }); await filters.click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(filters).toBeFocused();
});

test('refusing personalization prevents recently viewed storage and language updates document metadata', async ({ page, request }) => {
  const list = await (await request.get('/api/v1/products')).json(); const id = list.data[0].id;
  await page.goto(`/products/${id}`); await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => localStorage.getItem('recentlyViewed'))).toBeNull();
  await page.evaluate(() => localStorage.setItem('preferred_language', 'fr')); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

for (const path of ['/shop', '/signin', '/privacy', '/order-status']) test(`accessibility checks on ${path}`, async ({ page }) => {
  await page.goto(path); await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200); // Allow entrance animations to reach their final colors/opacity.
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
});
