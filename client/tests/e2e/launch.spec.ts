import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const argon2 = require('../../../server/node_modules/argon2');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Launch tests require an isolated database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = 'LaunchPassword123!';
const hash = argon2.hash(password);
const userIds: string[] = [], productIds: string[] = [], contactIds: string[] = [], orderIds: string[] = [];
async function fixture(page: Page, admin = true) {
  const user = await db.user.create({ data: { email: `launch-${crypto.randomUUID()}@example.com`, passwordHash: await hash, firstName: 'Launch', lastName: 'Tester', emailVerifiedAt: new Date(), isAdmin: admin } });
  userIds.push(user.id);
  await page.goto('/signin'); await page.locator('#email').fill(user.email); await page.locator('#password').fill(password); await page.locator('main form button[type=submit]').click(); await expect(page).not.toHaveURL(/\/signin/);
  return user;
}
async function checkout(page: Page) {
  await fixture(page, false);
  const product = await db.product.create({ data: { name: `Launch ${crypto.randomUUID()}`, price: 5000, category: 'hoodies', sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock: 20 } } } });
  productIds.push(product.id);
  await page.goto(`/products/${product.id}`); await page.getByRole('button', { name: 'M', exact: true }).click(); await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click(); await expect(page.getByText(/added to cart/i).first()).toBeVisible();
  await page.goto('/checkout');
}
async function message(email: string, subject = 'Launch request') {
  const row = await db.contactMessage.create({ data: { name: 'Launch Tester', email, subject, message: 'Hello <script>window.compromised=true</script>\nHelp with my order please.' } });
  contactIds.push(row.id); return row;
}
async function refund(page: Page) {
  const user = await fixture(page);
  const order = await db.order.create({ data: { userId: user.id, orderNumber: `BLP-LAUNCH-${crypto.randomUUID()}`, totalCents: 5995, shippingCents: 995, refundedCents: 1000, status: 'paid', paymentStatus: 'partially_refunded', transactionKey: `pi_synthetic_${crypto.randomUUID()}`, shippingAddress: { firstName: 'Launch', lastName: 'Tester', address: '1 Test Street', city: 'Ottawa', province: 'ON', postalCode: 'K1A 0B1', country: 'CA' }, items: { create: { productKey: 'launch', productName: 'Launch Hoodie', quantity: 1, unitPriceCents: 5000 } } } });
  orderIds.push(order.id);
  await page.goto('/admin/orders'); await page.getByRole('button', { name: new RegExp(order.orderNumber) }).click();
  const trigger = page.getByRole('button', { name: 'Refund the remaining balance', exact: true }); await trigger.click();
  return { order, trigger, dialog: page.getByRole('dialog') };
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('preferred_language')) localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
});
test.afterAll(async () => {
  await db.emailOutbox.deleteMany({ where: { id: { in: contactIds.map(id => `contact:${id}`) } } });
  await db.contactMessage.deleteMany({ where: { id: { in: contactIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test('contact submission reaches the durable outbox and the admin inbox, with persistent read flags', async ({ page }) => {
  const user = await fixture(page);
  await page.goto('/contact'); await page.locator('#name').fill('Launch Tester'); await page.locator('#email').fill(user.email); await page.locator('#subject').selectOption({ index: 1 }); await page.locator('#message').fill('Hello <script>window.compromised=true</script> please help with my order.');
  await page.getByRole('button', { name: 'Send Message', exact: true }).click(); await expect(page.getByRole('heading', { name: /message sent/i })).toBeVisible();
  const row = await db.contactMessage.findFirstOrThrow({ where: { email: user.email } }); contactIds.push(row.id);
  const queued = await db.emailOutbox.findUniqueOrThrow({ where: { id: `contact:${row.id}` } }); expect(queued.payload.to).toBe('support@example.invalid'); expect(queued.payload.html).toContain('&lt;script&gt;');
  await page.goto('/admin'); await page.getByRole('link', { name: 'Customer messages', exact: true }).click(); await page.locator('#support-search').fill(user.email);
  const card = page.locator('main article'); await expect(card).toHaveCount(1); await card.getByText('Read message', { exact: true }).click(); await expect(card).toContainText('<script>window.compromised=true</script>'); expect(await card.locator('script').count()).toBe(0);
  await expect(card.getByRole('link', { name: 'Reply by email' })).toHaveAttribute('href', /^mailto:launch-.*%40example.com\?subject=Re/);
  await card.getByRole('button', { name: 'Mark as read', exact: true }).click(); await expect(card).toHaveCount(0);
  await page.locator('#support-status').selectOption('read'); await expect(card).toHaveCount(1); await page.reload(); await page.locator('#support-status').selectOption('read'); await page.locator('#support-search').fill(user.email); await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Mark as unread', exact: true }).click(); await expect(card).toHaveCount(0); expect((await db.contactMessage.findUniqueOrThrow({ where: { id: row.id } })).readAt).toBeNull();
});

test('support search stays paginated and a failed load can be retried', async ({ page }) => {
  const user = await fixture(page); for (let index = 0; index < 21; index++) await message(user.email, `Launch request ${index}`);
  let fail = true; await page.route('**/admin/contact?*', route => fail ? route.abort('failed') : route.continue());
  await page.goto('/admin/contact'); await expect(page.locator('main').getByRole('alert')).toBeVisible(); fail = false; await page.locator('main').getByRole('alert').getByRole('button').click();
  await page.locator('#support-search').fill(user.email); await expect(page.locator('main article')).toHaveCount(20);
  await page.locator('main nav').last().getByRole('button', { name: /2/ }).click(); await expect(page.locator('main article')).toHaveCount(1);
  await page.locator('#support-search').fill('does-not-exist-' + user.email); await expect(page.locator('main article')).toHaveCount(0); await expect(page.locator('main')).toContainText('No messages match');
});

test('support inbox is accessible at 320 px in French', async ({ page }, testInfo) => {
  const user = await fixture(page); await message(user.email); await page.setViewportSize({ width: 320, height: 740 }); await page.evaluate(() => localStorage.setItem('preferred_language', 'fr'));
  await page.goto('/admin/contact'); await page.locator('#support-search').fill(user.email); await expect(page.locator('main article')).toHaveCount(1); await page.locator('main summary').click();
  // Complete the footer entrance animation before measuring its final contrast.
  await page.locator('footer').scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({ path: testInfo.outputPath('support-mobile-fr.png'), fullPage: true });
});

test('ordinary customers cannot open the support inbox', async ({ page }) => {
  await fixture(page, false); await page.goto('/admin/contact'); await expect(page).not.toHaveURL(/\/admin\/contact/); await expect(page.locator('#support-search')).toHaveCount(0);
});

test('checkout uses configured countries and their different delivery fees', async ({ page }) => {
  await page.route('**/commerce/config', route => route.fulfill({ json: { success: true, data: { currency: 'CAD', shippingRates: [{ country: 'CA', feeCents: 750, freeThresholdCents: 10000 }, { country: 'FR', feeCents: 2400, freeThresholdCents: null }] } } }));
  await checkout(page); await expect(page.locator('#shipping-country option')).toHaveCount(2); await expect(page.locator('main')).toContainText('$57.50');
  await page.locator('#shipping-country').selectOption('FR'); await expect(page.locator('main')).toContainText('$74.00'); await expect(page.locator('#shipping-country option[value=US]')).toHaveCount(0);
});

test('checkout does not silently choose another country when Canada is not served', async ({ page }) => {
  await page.route('**/commerce/config', route => route.fulfill({ json: { success: true, data: { currency: 'CAD', shippingRates: [{ country: 'FR', feeCents: 2400, freeThresholdCents: null }] } } }));
  await checkout(page); await expect(page.locator('main').getByRole('alert')).toBeVisible(); await expect(page.locator('#shipping-country')).toHaveValue('CA'); await expect(page.locator('#shipping-country option:checked')).toHaveText('Choose a delivery country');
  await page.locator('#shipping-country').selectOption('FR'); await expect(page.locator('main')).toContainText('$74.00'); await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
});

test('a delivery configuration outage hides unknown totals and offers a working retry', async ({ page }) => {
  let fail = true; await page.route('**/commerce/config', route => fail ? route.abort('failed') : route.continue());
  await checkout(page); const alert = page.locator('main').getByRole('alert'); await expect(alert).toBeVisible(); await expect(page.getByRole('button', { name: /continue to payment/i })).toBeDisabled();
  await expect(page.locator('main')).not.toContainText('$59.95'); fail = false; await alert.getByRole('button').click(); await expect(alert).toHaveCount(0); await expect(page.locator('main')).toContainText('$59.95');
});

test('refund dialog explains the full remaining amount and restores keyboard focus', async ({ page }, testInfo) => {
  const { dialog, trigger } = await refund(page); await expect(dialog).toContainText('$49.95 CAD'); await expect(dialog).toContainText('entire remaining balance');
  await page.setViewportSize({ width: 320, height: 740 }); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('refund-mobile.png') }); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('refund retry preserves its request after a lost response (provider fixture)', async ({ page }) => {
  const bodies: unknown[] = []; await page.route('**/payments/refund', async route => { bodies.push(route.request().postDataJSON()); if (bodies.length === 1) await route.abort('failed'); else await route.fulfill({ json: { success: true, data: { status: 'pending' } } }); });
  const { order, dialog } = await refund(page); await page.locator('#refund-reason').fill('  Returned after inspection  '); await dialog.getByRole('button', { name: 'Request the refund', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(page.locator('#refund-reason')).toBeDisabled();
  await dialog.getByRole('button', { name: 'Request the refund', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(bodies).toHaveLength(2); expect(bodies[0]).toEqual(bodies[1]); expect(bodies[0]).toEqual({ orderId: order.id, expectedRefundedCents: 1000, reason: 'Returned after inspection' });
});

test('a stale refund requires closing and refreshing the order (provider fixture)', async ({ page }) => {
  await page.route('**/payments/refund', route => route.fulfill({ status: 409, json: { success: false, error: { code: 'CONFLICT', message: 'Balance changed' } } }));
  const { dialog } = await refund(page); await dialog.getByRole('button', { name: 'Request the refund', exact: true }).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Request the refund', exact: true })).toHaveCount(0); await dialog.getByRole('button', { name: 'Close', exact: true }).last().click(); await expect(dialog).toHaveCount(0);
});

for (const [view, endpoint] of [
  ['/admin/orders', '**/orders?*'],
  ['/admin/products', '**/admin/products?*'],
  ['/admin/reviews', '**/reviews/admin/all?*'],
  ['/profile/orders', '**/orders/mine?*'],
  ['/profile/loyalty', '**/loyalty/transactions?*'],
]) {
  test(`large page counts remain usable at 320 px on ${view} (pagination fixture)`, async ({ page }) => {
    await fixture(page); await page.setViewportSize({ width: 320, height: 740 });
    const requested: string[] = [];
    await page.route(endpoint, async route => {
      requested.push(new URL(route.request().url()).searchParams.get('page') ?? '1');
      const response = await route.fetch(); const body = await response.json();
      // Keep the real API data/authentication, simulate a catalogue with 1000 pages.
      body.pagination.totalPages = 1000; body.pagination.totalItems = 15000;
      await route.fulfill({ response, json: body });
    });
    await page.goto(view); const pager = page.locator('main nav').last();
    await expect(pager.getByRole('button', { name: 'Page 1000', exact: true })).toBeVisible();
    expect(await pager.getByRole('button').count()).toBeLessThanOrEqual(5);
    for (const button of await pager.getByRole('button').all()) {
      const box = await button.boundingBox(); expect(Number(box!.width.toFixed(2))).toBeGreaterThanOrEqual(44); expect(Number(box!.height.toFixed(2))).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await pager.getByRole('button', { name: 'Page 1000', exact: true }).click();
    await expect(pager.locator('[aria-current=page]')).toHaveText('1000'); await expect.poll(() => requested.includes('1000')).toBe(true);
    await pager.getByRole('button', { name: 'Page 1', exact: true }).click(); await expect(pager.locator('[aria-current=page]')).toHaveText('1');
    expect(await pager.getByRole('button').count()).toBeLessThanOrEqual(5);
  });
}

test('French refund confirmation is accessible and fits 320 px', async ({ page }, testInfo) => {
  const { order } = await refund(page); await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.setItem('preferred_language', 'fr')); await page.setViewportSize({ width: 320, height: 740 }); await page.reload();
  await page.getByRole('button', { name: new RegExp(order.orderNumber) }).click();
  await page.getByRole('button', { name: 'Rembourser le solde restant', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('frais de livraison');
  await expect(dialog.getByRole('button', { name: 'Demander le remboursement', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('refund-mobile-fr.png') });
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
