import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const argon2 = require('../../../server/node_modules/argon2');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Workflow fixtures require an isolated database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = 'WorkflowPassword123!';
const hash = argon2.hash(password);
const address = { firstName: 'Workflow', lastName: 'Test', addressLine1: '123 Test Street', city: 'Montreal', province: 'QC', postalCode: 'H2X 1Y4', country: 'CA' };
async function member(admin = false) { return db.user.create({ data: { email: `workflow-${crypto.randomUUID()}@example.com`, passwordHash: await hash, firstName: 'Workflow', lastName: 'Test', emailVerifiedAt: new Date(), isAdmin: admin } }); }
async function credentials(page: Page, email: string, secret = password) {
  await page.goto('/signin'); await page.locator('#email').fill(email); await page.locator('#password').fill(secret);
  await page.locator('main form button[type=submit]').click();
}
async function login(page: Page, email: string, secret = password) { await credentials(page, email, secret); await expect(page).not.toHaveURL(/\/signin/); }
async function signout(page: Page) { await page.goto('/profile'); await page.getByRole('button', { name: /sign out/i }).first().click(); await expect(page).not.toHaveURL(/\/profile/); }
async function accessible(page: Page) { await page.waitForTimeout(600); expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) }))).toEqual([]); }
async function catalogue() { return db.product.findFirstOrThrow({ where: { name: 'Classic Black Hoodie', isActive: true } }); }
function totp(secret: string) {
  const bits = [...secret].map(c => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g)!.map(b => parseInt(b, 2))); const time = Buffer.alloc(8); time.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', key).update(time).digest(); const offset = h[19] & 15;
  return ((h.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
});
test.afterAll(async () => db.$disconnect());

test('MFA enrollment, authenticator login and single-use recovery code work in the browser', async ({ page }) => {
  test.setTimeout(60000); const user = await member(); await page.setViewportSize({ width: 390, height: 844 });
  await login(page, user.email); await page.goto('/profile'); await page.getByRole('button', { name: 'Enable two-factor authentication', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  const setupResponse = page.waitForResponse(r => r.url().endsWith('/auth/mfa/setup') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: /enable/i }).click();
  const setup = (await (await setupResponse).json()).data; const secret = new URL(setup.otpauthUrl).searchParams.get('secret')!;
  await page.locator('#mfa-code').fill(totp(secret)); await dialog.getByRole('button', { name: /verify/i }).click();
  const codes = page.getByRole('list', { name: 'Recovery codes' }).locator('li'); await expect(codes).toHaveCount(10);
  const backup = (await codes.first().textContent())!;
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click(); await expect(dialog).toHaveCount(0);
  await credentials(page, user.email); await page.locator('#mfa-token').fill(totp(secret)); await page.locator('main form button[type=submit]').click(); await expect(page).not.toHaveURL(/\/signin/);
  await signout(page); await credentials(page, user.email); await page.locator('#mfa-token').fill(backup.toLowerCase());
  await page.locator('main form button[type=submit]').click(); await expect(page).not.toHaveURL(/\/signin/);
  expect((await db.mfaSetup.findUniqueOrThrow({ where: { userId: user.id } })).backupCodes).toHaveLength(9);
  await signout(page); await credentials(page, user.email); await page.locator('#mfa-token').fill(backup);
  const rejectedRecovery = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.locator('main form button[type=submit]').click();
  expect((await rejectedRecovery).status()).toBe(401);
  await expect(page.locator('main')).toContainText(/code did not match/i); await expect(page).toHaveURL(/\/signin/);
  await page.locator('#mfa-token').fill(totp(secret)); await page.locator('main form button[type=submit]').click(); await expect(page).not.toHaveURL(/\/signin/);
  await page.goto('/profile'); await page.locator('#mfa-disable-code').fill(totp(secret));
  await page.getByRole('button', { name: 'Disable two-factor authentication', exact: true }).click(); await expect(page).toHaveURL(/\/signin/);
  expect(await db.mfaSetup.findUnique({ where: { userId: user.id } })).toBeNull(); await login(page, user.email);
});

test('password changes revoke the session and the new password signs in', async ({ page }) => {
  const user = await member(); await login(page, user.email); await page.goto('/profile');
  await page.getByRole('button', { name: 'Change', exact: true }).click(); await page.getByLabel('Current Password', { exact: true }).fill(password);
  await page.getByLabel('New Password', { exact: true }).fill('ChangedWorkflow123!'); await page.getByRole('button', { name: 'Update Password', exact: true }).click();
  await expect(page).toHaveURL(/\/signin/); await credentials(page, user.email); await expect(page.locator('main')).toContainText(/invalid.*credentials/i);
  await login(page, user.email, 'ChangedWorkflow123!'); await page.goto('/profile'); await expect(page.locator('main')).toContainText(user.email);
});

test('password reset uses the locally captured email and rejects token reuse', async ({ page }) => {
  const user = await member(); await page.goto('/forgot-password'); await page.locator('main').getByLabel('Email', { exact: true }).fill(user.email);
  const sent = page.waitForResponse(r => r.url().endsWith('/auth/forgot-password') && r.request().method() === 'POST'); await page.locator('main form button[type=submit]').click(); expect((await sent).ok()).toBe(true);
  const mail = await db.emailOutbox.findFirstOrThrow({ where: { payload: { path: ['to'], equals: user.email } }, orderBy: { createdAt: 'desc' } });
  const token = mail.payload.html.match(/token=([a-f0-9]{64})/)[1];
  async function reset() { await page.goto('about:blank'); await page.goto(`/reset-password#token=${token}`); await page.getByLabel('New Password', { exact: true }).fill('ResetWorkflow123!'); await page.getByLabel('Confirm Password', { exact: true }).fill('ResetWorkflow123!'); await page.locator('main form button[type=submit]').click(); }
  await reset(); await expect(page.locator('main')).toContainText(/password has been reset/i);
  await reset(); await expect(page.locator('main')).toContainText(/invalid|expired/i);
  await login(page, user.email, 'ResetWorkflow123!');
});

test('account deletion requires credentials, records deletion and prevents login', async ({ page }) => {
  const user = await member(); await login(page, user.email); await page.goto('/profile');
  const trigger = page.getByRole('button', { name: 'Delete My Account' }); await trigger.click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await expect(dialog.getByRole('button', { name: 'Delete Account', exact: true })).toBeDisabled();
  await dialog.locator('input[type=password]').fill(password); await dialog.getByRole('button', { name: 'Delete Account', exact: true }).click(); await expect(page).not.toHaveURL(/\/profile/);
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).deletedAt).not.toBeNull();
  await credentials(page, user.email); await expect(page.locator('main')).toContainText(/invalid.*credentials/i);
});

test('saved addresses support edit, default selection and deletion on mobile', async ({ page }) => {
  const user = await member(); const first = await db.address.create({ data: { ...address, userId: user.id, isDefault: true } });
  const second = await db.address.create({ data: { ...address, addressLine1: '456 Second Street', userId: user.id } });
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, user.email); await page.goto('/profile/addresses');
  await page.getByRole('button', { name: 'Edit 456 Second Street', exact: true }).click(); await page.locator('#field-city').fill('Quebec');
  await page.getByRole('button', { name: 'Save Address', exact: true }).click(); await expect(page.locator('main')).toContainText('Quebec');
  await page.getByRole('button', { name: 'Set as default address 456 Second Street', exact: true }).click();
  await expect.poll(async () => (await db.address.findUniqueOrThrow({ where: { id: second.id } })).isDefault).toBe(true);
  await accessible(page); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Delete 123 Test Street', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('main')).not.toContainText('123 Test Street'); expect(await db.address.findUnique({ where: { id: first.id } })).toBeNull();
});

test('customer reviews can be created, edited and deleted with keyboard-accessible dialogs', async ({ page }) => {
  const user = await member(); const product = await catalogue(); await login(page, user.email); await page.goto(`/products/${product.id}`);
  const trigger = page.getByRole('button', { name: 'Write a Review', exact: true }); await trigger.click();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(trigger).toBeFocused(); await trigger.click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: '5 stars', exact: true }).click();
  await page.locator('#review-title').fill('Workflow review'); await page.locator('#review-comment').fill('Comfortable hoodie tested through the browser.');
  await accessible(page); await dialog.getByRole('button', { name: 'Submit Review' }).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Review', exact: true }).click(); await page.locator('#review-title').fill('Updated workflow review');
  await dialog.getByRole('button', { name: 'Update Review' }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText('Updated workflow review', { exact: true })).toBeVisible();
  page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Delete Review', exact: true }).click();
  await expect(trigger).toBeVisible(); expect(await db.review.count({ where: { userId: user.id } })).toBe(0);
});

test('contact validates the form and stores a real message without external delivery', async ({ page }) => {
  const email = `contact-${crypto.randomUUID()}@example.com`; await page.goto('/contact');
  await page.getByRole('button', { name: 'Send Message', exact: true }).click(); await expect(page.locator('main')).toContainText(/name.*required/i);
  await page.locator('#name').fill('Workflow Test'); await page.locator('#email').fill(email); await page.locator('#subject').selectOption({ index: 1 });
  await page.locator('#message').fill('This is an isolated browser test message.'); await page.getByRole('button', { name: 'Send Message', exact: true }).click();
  await expect(page.getByRole('heading', { name: /message sent/i })).toBeVisible(); expect(await db.contactMessage.count({ where: { email } })).toBe(1);
});

test('order summary separates shipping from the discount and marks paid progress', async ({ page }) => {
  const user = await member(); const order = await db.order.create({ data: { userId: user.id, orderNumber: `BLP-WF-${crypto.randomBytes(5).toString('hex')}`, totalCents: 9094, shippingCents: 995, discountCents: 900, paymentStatus: 'paid', status: 'paid', shippingAddress: address, items: { create: { productKey: 'workflow', productName: 'Workflow Hoodie', quantity: 1, unitPriceCents: 8999 } }, statusHistory: { create: { status: 'paid' } } } });
  await login(page, user.email); await page.goto(`/profile/orders/${order.id}`);
  for (const [label, amount] of [['Subtotal', '89.99'], ['Shipping', '9.95'], ['Discount', '9.00'], ['Total', '90.94']]) await expect(page.locator('main').getByText(label, { exact: true }).locator('..')).toContainText(amount);
  await expect(page.locator('[aria-current=step]')).toContainText('Paid');
});

test('admin fulfills an order through each allowed status and persists history', async ({ page }) => {
  const user = await member(true); const order = await db.order.create({ data: { userId: user.id, orderNumber: `BLP-WF-${crypto.randomBytes(5).toString('hex')}`, totalCents: 8999, status: 'paid', paymentStatus: 'paid', shippingAddress: address, items: { create: { productKey: 'workflow', productName: 'Workflow Hoodie', quantity: 1, unitPriceCents: 8999 } } } });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, user.email); await page.goto('/admin/orders'); await page.getByRole('button', { name: new RegExp(order.orderNumber) }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const select = page.getByRole('combobox', { name: /update status/i });
  for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) { await select.selectOption(status); await expect(select).toHaveValue(status); await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(status); }
  const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } }); expect(history.map((h: any) => h.status)).toEqual(['confirmed', 'processing', 'shipped', 'delivered']);
  await page.goto(`/profile/orders/${order.id}`); await expect(page.locator('[aria-current=step]')).toContainText('Delivered');
});

test('search ignores stale network responses and offers retry on failure', async ({ page }) => {
  let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; }); let obsoleteDone!: () => void; const completed = new Promise<void>(resolve => { obsoleteDone = resolve; });
  await page.route('**/api/v1/products?*', async route => {
    if (new URL(route.request().url()).searchParams.get('search') === 'Hoodie') {
      const response = await route.fetch(); await blocked; await route.fulfill({ response }); obsoleteDone();
    } else await route.continue();
  });
  await page.goto('/search?q=Hoodie'); await page.locator('main input[type=text]').fill('Ocean');
  await expect(page.locator('main').getByRole('link', { name: /Ocean Blue Hoodie/ })).toBeVisible(); release(); await completed;
  await expect(page.locator('main').getByRole('link', { name: /Classic Black Hoodie/ })).toHaveCount(0);
  await page.unrouteAll({ behavior: 'wait' }); let fail = true;
  await page.route('**/api/v1/products?*', route => fail ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Synthetic outage' } }) }) : route.continue());
  await page.goto('/search?q=Hoodie'); await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  fail = false; await page.getByRole('button', { name: /try again/i }).click(); await expect(page.locator('main').getByRole('link', { name: /Classic Black Hoodie/ })).toBeVisible();
});

test('newsletter requires consent, confirms locally and supports unsubscribe', async ({ page }) => {
  const email = `newsletter-${crypto.randomUUID()}@example.com`; await page.goto('/');
  const footer = page.locator('footer'); await footer.getByRole('textbox').fill(email); await footer.locator('button[type=submit]').click();
  await expect(footer).toContainText(/consent|agree/i); expect(await db.newsletterSubscription.count({ where: { email } })).toBe(0);
  await footer.getByRole('checkbox').check(); const subscribed = page.waitForResponse(r => r.url().endsWith('/newsletter/subscribe'));
  await footer.locator('button[type=submit]').click(); expect((await subscribed).ok()).toBe(true);
  expect((await db.newsletterSubscription.findUniqueOrThrow({ where: { email } })).isActive).toBe(false);
  const mail = await db.emailOutbox.findFirstOrThrow({ where: { payload: { path: ['to'], equals: email } } }); const token = mail.payload.html.match(/token=([a-f0-9]{64})/)[1];
  await page.goto(`/newsletter/confirm#token=${token}`); await page.getByRole('button', { name: 'Confirm subscription' }).click(); await expect(page.getByRole('status')).toContainText('Your choice has been saved.');
  expect((await db.newsletterSubscription.findUniqueOrThrow({ where: { email } })).isActive).toBe(true);
  const confirmed = await db.emailOutbox.findFirstOrThrow({ where: { payload: { path: ['to'], equals: email } }, orderBy: { createdAt: 'desc' } }); const unsubscribe = confirmed.payload.html.match(/unsubscribe=([a-f0-9]{64})/)[1];
  await page.goto('/'); await page.goto(`/newsletter/confirm#unsubscribe=${unsubscribe}`); await page.getByRole('button', { name: 'Confirm unsubscribe' }).click(); await expect(page.getByRole('status')).toContainText('Your choice has been saved.');
  expect((await db.newsletterSubscription.findUniqueOrThrow({ where: { email } })).isActive).toBe(false);
});

test('admin product editing and deletion persist and confirmation restores focus', async ({ page }) => {
  const user = await member(true); const original = await catalogue();
  const product = await db.product.create({ data: { name: `Workflow product ${crypto.randomUUID()}`, price: 5000, category: original.category, isActive: true, images: original.images, sizes: ['M'], colors: ['black'], variants: { create: { size: 'M', color: 'black', stock: 4 } } } });
  await login(page, user.email); await page.goto(`/admin/products/${product.id}/edit`);
  const name = `${product.name} updated`; await page.locator('#field-name').fill(name); await page.locator('#field-price').fill('63.45'); await page.getByRole('spinbutton', { name: /^Stock/ }).fill('9');
  await page.locator('main form button[type=submit]').click(); await expect(page).toHaveURL(/\/admin\/products$/);
  const saved = await db.product.findUniqueOrThrow({ where: { id: product.id }, include: { variants: true } }); expect(saved.price).toBe(6345); expect(saved.variants[0].stock).toBe(9);
  const remove = page.getByRole('button', { name: `Delete ${name}`, exact: true }); await remove.click();
  const dialog = page.getByRole('dialog'); await accessible(page); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(remove).toBeFocused();
  await remove.click(); await dialog.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(remove).toHaveCount(0); expect(await db.product.findFirst({ where: { id: product.id, deletedAt: null } })).toBeNull();
});

test('cart quantities, valid and invalid coupons, and separate billing work on mobile', async ({ page }) => {
  const product = await catalogue(); const coupon = await db.coupon.create({ data: { code: `UI-${crypto.randomBytes(6).toString('hex')}`.toUpperCase(), discountType: 'percentage', discountValue: 10 } });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`/products/${product.id}`); await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Increase quantity', exact: true }).click(); await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click();
  await expect(page.getByText(/added to cart/i).first()).toBeVisible(); await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await expect(page.getByRole('button', { name: 'Cart', exact: true })).toBeInViewport(); await page.getByRole('button', { name: 'Cart', exact: true }).click();
  const cart = page.getByRole('dialog'); await expect(cart).toContainText('179.98'); await cart.getByRole('button', { name: 'Decrease quantity', exact: true }).click(); await expect(cart).toContainText('89.99');
  await page.keyboard.press('Escape'); await page.reload(); await page.goto('/checkout');
  await page.getByRole('button', { name: /have.*promo/i }).click(); const code = page.getByPlaceholder(/enter.*code/i); await code.fill('INVALID-UI-CODE');
  await page.getByRole('button', { name: 'Apply', exact: true }).click(); await expect(page.locator('main')).toContainText(/invalid|not found/i);
  await code.fill(coupon.code); await page.getByRole('button', { name: 'Apply', exact: true }).click(); await expect(page.getByText(coupon.code, { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /billing.*same/i }).click(); await page.locator('#billing-province').fill('QC'); await accessible(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: /remove promo/i }).click(); await expect(page.getByText(coupon.code, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /continue to payment/i })).toBeDisabled();
  await db.coupon.delete({ where: { id: coupon.id } });
});

test('saved card controls and deletion dialog work with explicit provider fixtures', async ({ page }) => {
  const user = await member(); let cards = [{ id: 'pm_ui_fixture_one', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030, isDefault: true }, { id: 'pm_ui_fixture_two', brand: 'mastercard', last4: '4444', expMonth: 8, expYear: 2030, isDefault: false }];
  await page.route('**/api/v1/payments/methods**', route => {
    const req = route.request(); const id = new URL(req.url()).pathname.split('/')[5];
    if (req.method() === 'DELETE') cards = cards.filter(card => card.id !== id);
    if (req.method() === 'PATCH') cards = cards.map(card => ({ ...card, isDefault: card.id === id }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: req.method() === 'GET' ? cards : {} }) });
  });
  await login(page, user.email); await page.goto('/profile/payment-methods'); await page.getByRole('button', { name: 'Set Default', exact: true }).click();
  expect(cards.find(card => card.id === 'pm_ui_fixture_two')?.isDefault).toBe(true);
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click(); const dialog = page.getByRole('dialog'); await accessible(page);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await page.getByRole('button', { name: 'Remove', exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(page.locator('main')).not.toContainText('4242');
});

test('admin moderates a review on mobile with a labelled confirmation dialog', async ({ page }) => {
  const user = await member(true); const product = await catalogue(); const title = `Moderation ${crypto.randomUUID()}`;
  const review = await db.review.create({ data: { userId: user.id, productId: product.id, rating: 1, title, comment: 'Synthetic review for browser moderation.' } });
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, user.email); await page.goto('/admin/reviews');
  await page.getByRole('button', { name: '1 Star', exact: true }).click();
  const remove = page.getByRole('button', { name: `Delete Review: ${title}`, exact: true }); await remove.click(); const dialog = page.getByRole('dialog');
  await accessible(page); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(remove).toBeFocused();
  await remove.click(); await dialog.getByRole('button', { name: 'Delete Review', exact: true }).click(); await expect(dialog).toHaveCount(0);
  expect(await db.review.findUnique({ where: { id: review.id } })).toBeNull();
});

test('French account security controls and dialog labels are translated', async ({ page }) => {
  const user = await member(); await login(page, user.email); await page.evaluate(() => localStorage.setItem('preferred_language', 'fr'));
  // Preserve the selected language when this test loads another document.
  await page.addInitScript(() => localStorage.setItem('preferred_language', 'fr')); await page.goto('/profile');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr'); await page.getByRole('button', { name: /activer.*authentification/i }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await expect(dialog).not.toContainText('common.close');
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click(); await expect(dialog).toHaveCount(0);
});

test('shop combines filters, handles empty price ranges, sorts and converts currency', async ({ page }) => {
  await page.goto('/shop');
  await page.locator('main').getByRole('button', { name: 'Hoodies', exact: true }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click(); await page.getByRole('button', { name: 'M', exact: true }).click();
  await expect(page.locator('main').getByRole('link', { name: /Classic Black Hoodie/ })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: /Ocean Blue Hoodie/ })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Minimum price' }).fill('100'); await expect(page.getByRole('heading', { name: /No products/i })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Minimum price' }).fill(''); await expect(page.locator('main').getByRole('link', { name: /Classic Black Hoodie/ })).toBeVisible();
  await page.getByRole('button', { name: 'Newest', exact: true }).click(); await page.getByRole('button', { name: 'Price: Low to High', exact: true }).click();
  await expect(page).toHaveURL(/sort=price%3Aasc/);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.getByRole('button', { name: 'Select currency' }).click();
  await page.getByRole('button', { name: /USD/ }).click(); await expect(page.getByRole('button', { name: 'Select currency' })).toContainText('USD');
  const rates = (await (await page.request.get('/api/v1/currencies/rates')).json()).data;
  await expect(page.locator('main')).toContainText((Math.round(8999 * rates.rates.USD) / 100).toFixed(2));
  await accessible(page);
  await page.getByRole('button', { name: 'Remove filter: Size M', exact: true }).click(); await page.getByRole('button', { name: 'Remove filter: Black', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Black', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('main').getByRole('link', { name: /Ocean Blue Hoodie/ })).toBeVisible();
});
