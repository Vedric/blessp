import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Deep UI tests require an isolated database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = 'DeepBrowserPassword123!';
const uniqueEmail = () => `deep-${crypto.randomUUID()}@example.com`;
async function preferences(page: Page, language = 'en') {
  await page.addInitScript(language => {
    localStorage.setItem('preferred_language', language);
    localStorage.setItem('blessp_cookie_consent', 'rejected');
    localStorage.setItem('blessp_mfa_reminded_at', String(Date.now()));
  }, language);
}
async function fillRegistration(page: Page, email: string, confirmation = password) {
  await page.goto('/signup');
  for (const [id, value] of Object.entries({ firstName: 'Élodie', lastName: 'O’Connor', email, password, confirmPassword: confirmation })) await page.locator(`#${id}`).fill(value);
}
async function submit(page: Page) { await page.locator('main form button[type=submit]').click(); }
async function registration(page: Page, email: string) {
  await fillRegistration(page, email); await submit(page); await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.getByRole('heading', { name: /Verify your email address|Vérifiez votre adresse e-mail/ })).toBeVisible();
  const user = await db.user.findUniqueOrThrow({ where: { email } }); expect(user.emailVerifiedAt).toBeNull(); return user;
}
async function tokenFor(email: string) {
  const mail = await db.emailOutbox.findFirstOrThrow({ where: { AND: [{ payload: { path: ['to'], equals: email } }, { payload: { path: ['html'], string_contains: '/verify-email' } }] }, orderBy: { createdAt: 'desc' } });
  return mail.payload.html.match(/token=([a-f0-9]{64})/)[1];
}
async function confirm(page: Page, token: string) {
  await page.goto(`/verify-email#token=${token}`);
  const verification = page.waitForResponse(r => r.url().endsWith('/auth/verify-email') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Confirm my email|Confirmer mon adresse/ }).click();
  await verification;
  await expect(page.getByRole('status')).not.toBeEmpty();
}
async function credentials(page: Page, email: string, secret = password) {
  await page.goto('/signin'); await page.locator('#email').fill(email); await page.locator('#password').fill(secret); await submit(page);
}
async function login(page: Page, email: string) { await credentials(page, email); await expect(page).not.toHaveURL(/\/signin/); }
async function product() { return db.product.findFirstOrThrow({ where: { name: 'Classic Black Hoodie', isActive: true } }); }
async function addProduct(page: Page) {
  const item = await product(); await page.goto(`/products/${item.id}`); await page.getByRole('button', { name: 'M', exact: true }).click();
  await expect(page.getByRole('button', { name: 'M', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Add to cart$|^Ajouter au panier$/i }).first().click();
  await expect(page.getByText(/added to cart|ajouté au panier/i).first()).toBeVisible(); return item;
}
async function accessible(page: Page) {
  // Footer/product entrance animations include staggered children (~1 s).
  await page.waitForTimeout(1200);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) }))).toEqual([]);
}
async function fits(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }
test.beforeEach(async ({ page }) => preferences(page));
test.afterAll(async () => db.$disconnect());

test('registration refuses a missing password confirmation without creating an account', async ({ page }) => {
  const email = uniqueEmail(); let requests = 0;
  page.on('request', r => { if (r.url().endsWith('/auth/register')) requests++; });
  await fillRegistration(page, email, ''); await submit(page);
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.locator('#confirmPassword')).toHaveAttribute('aria-invalid', 'true');
  expect(requests).toBe(0); expect(await db.user.findUnique({ where: { email } })).toBeNull();
  await accessible(page);
});

for (const language of ['en', 'fr']) test(`complete UI signup, verification, cart merge and login lifecycle (${language})`, async ({ page, context }) => {
  test.setTimeout(90000); await preferences(page, language); if (language === 'fr') await page.setViewportSize({ width: 320, height: 740 });
  const email = uniqueEmail(); const item = await addProduct(page); await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('blessp_guest_cart')!)[0].quantity)).toBe(1);
  const user = await registration(page, email); const token = await tokenFor(email);
  await credentials(page, email); await expect(page).toHaveURL(/\/signin/); await expect(page.locator('.bg-red-50')).toContainText(/verif/i);
  await confirm(page, token); await expect(page.getByRole('status')).toContainText(/Email verified|Adresse vérifiée/);
  await login(page, email); await page.goto('/profile'); await expect(page.locator('main')).toContainText(email); await fits(page); await accessible(page);
  expect(await db.cartItem.findMany({ where: { userId: user.id } })).toEqual([expect.objectContaining({ productId: item.id, quantity: 1, size: 'M' })]);
  expect(await page.evaluate(() => localStorage.getItem('blessp_guest_cart'))).toBeNull();
  expect(await db.coupon.count({ where: { userId: user.id, campaign: 'welcome' } })).toBe(1);
  const cookies = await context.cookies(); expect(cookies.some(c => c.httpOnly && c.sameSite === 'Strict')).toBe(true);
  const sibling = await context.newPage(); await preferences(sibling, language); await sibling.goto('/profile', { waitUntil: 'domcontentloaded' }); await expect(sibling.locator('main')).toContainText(email); await sibling.close();
  await page.bringToFront(); await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('main')).toContainText(email);
  await page.getByRole('button', { name: /sign out|déconnexion/i }).first().click(); await page.goto('/profile'); await expect(page).toHaveURL(/\/signin/);
  await page.goto('/checkout'); await expect(page).toHaveURL(/\/shop$/);
  await login(page, email); await page.goto('/checkout'); await expect(page).toHaveURL(/\/checkout$/); await expect(page.locator('main')).toContainText('Classic Black Hoodie');
  await page.screenshot({ path: test.info().outputPath(`member-checkout-${language}.png`), fullPage: true });
});

test('resend invalidates the previous verification link, successful links are single use, duplicate signup is neutral', async ({ page }) => {
  const email = uniqueEmail(); const user = await registration(page, email); const oldToken = await tokenFor(email);
  await page.locator('main').getByLabel('Email', { exact: true }).fill(email);
  const resent = page.waitForResponse(r => r.url().endsWith('/auth/resend-verification')); await page.getByRole('button', { name: 'Resend link' }).click(); expect((await resent).ok()).toBe(true);
  const token = await tokenFor(email); expect(token).not.toBe(oldToken);
  await confirm(page, oldToken); await expect(page.getByRole('status')).toContainText(/invalid|expired/i);
  await confirm(page, token); await expect(page.getByRole('status')).toContainText('Email verified');
  await confirm(page, token); await expect(page.getByRole('status')).toContainText(/invalid|expired|used/i);
  await fillRegistration(page, email); await submit(page); await expect(page).toHaveURL(/\/verify-email$/);
  expect(await db.user.count({ where: { email } })).toBe(1); expect(await db.coupon.count({ where: { userId: user.id } })).toBe(1);
  await login(page, email);
});

test('expired verification links cannot activate a registered account', async ({ page }) => {
  const email = uniqueEmail(); const user = await registration(page, email); const token = await tokenFor(email);
  await db.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await confirm(page, token); await expect(page.getByRole('status')).toContainText(/expired/i);
  expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
});

test('registration shows server failure, preserves fields and can be retried once', async ({ page }) => {
  const email = uniqueEmail(); let count = 0;
  await page.route('**/api/v1/auth/register', async route => { if (++count === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Service temporarily unavailable' } }) }); else await route.continue(); });
  await fillRegistration(page, email); await submit(page); await expect(page.locator('.bg-red-50')).toBeVisible();
  await expect(page.locator('#email')).toHaveValue(email); await expect(page.locator('main form button[type=submit]')).toBeEnabled();
  await submit(page); await expect(page).toHaveURL(/\/verify-email$/); expect(await db.user.count({ where: { email } })).toBe(1);
});

for (const [name, viewport, touch] of [
  ['small-phone', { width: 320, height: 568 }, true], ['phone', { width: 430, height: 932 }, true],
  ['landscape', { width: 844, height: 390 }, true], ['tablet', { width: 768, height: 1024 }, true],
  ['tablet-landscape', { width: 1024, height: 768 }, true], ['desktop', { width: 1920, height: 1080 }, false],
] as const) test(`responsive navigation and filled forms: ${name}`, async ({ browser, browserName }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3107', viewport, isMobile: touch && browserName !== 'firefox', hasTouch: touch });
  const page = await context.newPage(); await preferences(page); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  const item = await product();
  try {
    for (const route of ['/', '/shop', `/products/${item.id}`, '/signup', '/signin', '/contact', '/order-status', '/privacy']) {
      await page.goto(route); await page.waitForLoadState('networkidle'); await expect(page.locator('main')).toBeVisible();
      if (route === '/signup') { await page.locator('#password').fill(password); await page.locator('#confirmPassword').fill(password); await page.locator('#confirmPassword').blur(); }
      // Exercise scroll-dependent content and load lazy images before auditing
      // and capturing the complete page, including the animated footer.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += viewport.height) {
        await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
        await page.waitForTimeout(80);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await fits(page); await accessible(page);
      await test.info().attach(`${name}-${route.replace(/\W/g, '_')}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');
    // Let the final staggered product cards finish before checking contrast
    // behind the menu/filter overlays. Their entrance can last one second.
    await page.waitForTimeout(1200);
    if (viewport.width < 768) {
      const menu = page.getByRole('button', { name: 'Open menu', exact: true }); await menu.click();
      const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await fits(page); await accessible(page);
      await dialog.getByRole('button', { name: 'Close menu' }).click(); await expect(dialog).toHaveCount(0); await expect(menu).toBeFocused();
    }
    if (viewport.width < 1024) {
      await page.getByRole('button', { name: /^filters/i }).click(); const filters = page.getByRole('dialog'); await expect(filters).toBeVisible();
      await expect.poll(async () => Math.round((await filters.boundingBox())!.y)).toBe(0);
      expect(Math.round((await filters.boundingBox())!.height)).toBe(viewport.height);
      await fits(page); await accessible(page); await page.keyboard.press('Escape'); await expect(filters).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('a UI-created address fills checkout and another account cannot inherit the member cart', async ({ page }) => {
  test.setTimeout(60000); await page.setViewportSize({ width: 360, height: 740 });
  const email = uniqueEmail(); await registration(page, email); await confirm(page, await tokenFor(email)); await login(page, email);
  await page.goto('/profile/addresses'); await page.getByRole('button', { name: /add.*address/i }).first().click();
  const address = { firstName: 'Élodie', lastName: 'O’Connor', addressLine1: '123 Deep Test Street', city: 'Montreal', postalCode: 'H2X 1Y4', province: 'QC' };
  for (const [key, value] of Object.entries(address)) await page.locator(`#field-${key}`).fill(value);
  await submit(page); await expect(page.locator('main')).toContainText(address.addressLine1);
  await addProduct(page); await page.goto('/checkout');
  await page.getByRole('button', { name: /123 Deep Test Street/ }).click();
  for (const [key, value] of Object.entries(address)) await expect(page.locator(`#shipping-${key}`)).toHaveValue(value);
  await expect(page.locator('#shipping-country')).toHaveValue('CA'); await fits(page); await accessible(page);
  await page.goto('/profile'); await page.getByRole('button', { name: /sign out/i }).first().click();
  const secondEmail = uniqueEmail(); const other = await registration(page, secondEmail); await confirm(page, await tokenFor(secondEmail)); await login(page, secondEmail);
  await page.goto('/checkout'); await expect(page).toHaveURL(/\/shop$/); expect(await db.cartItem.count({ where: { userId: other.id } })).toBe(0);
  await page.goto('/profile/addresses'); await expect(page.locator('main')).not.toContainText(address.addressLine1);
});

test('mobile landscape menu keeps its last link and currency choices reachable by touch', async ({ browser, browserName }) => {
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3107', viewport: { width: 667, height: 320 }, isMobile: browserName !== 'firefox', hasTouch: true });
  const page = await context.newPage(); await preferences(page);
  try {
    await page.goto('/'); await page.getByRole('button', { name: 'Open menu', exact: true }).tap();
    const dialog = page.getByRole('dialog'); const signup = dialog.getByRole('link', { name: /sign up/i });
    await signup.scrollIntoViewIfNeeded(); await expect(signup).toBeInViewport();
    const currency = dialog.getByRole('button', { name: 'Select currency' }); await currency.tap();
    const chf = dialog.getByRole('button', { name: 'CHF CHF', exact: true }); await chf.scrollIntoViewIfNeeded(); await expect(chf).toBeInViewport(); await chf.tap(); await expect(currency).toContainText('CHF');
    await dialog.getByRole('button', { name: 'Close menu' }).tap(); await expect(dialog).toHaveCount(0);
  } finally { await context.close(); }
});

test('all password strength states and invalid signup fields remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.goto('/signup');
  for (const value of ['a', 'abcABC123', 'abcABC123!Long']) { await page.locator('#password').fill(value); await accessible(page); }
  await page.locator('#password').fill(''); await submit(page); await accessible(page);
  await expect(page.locator('#firstName')).toBeFocused();
  await expect(page.locator('[aria-invalid=true]')).toHaveCount(5);
});

test('language and currency dropdowns expose their state and restore keyboard focus on Escape', async ({ page }) => {
  await page.goto('/shop');
  for (const label of ['Select language', 'Select currency']) {
    const trigger = page.getByRole('button', { name: label, exact: true }); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab'); await page.keyboard.press('Escape'); await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(trigger).toBeFocused();
  }
});

test('navigation does not remount the newly displayed form and erase immediate typing', async ({ page }) => {
  const email = uniqueEmail(); await registration(page, email);
  const input = page.locator('main').getByLabel('Email', { exact: true }); await input.fill(email);
  // The previous route exit lasted 250 ms and discarded this filled input.
  await page.waitForTimeout(700); await expect(input).toHaveValue(email);
  await page.getByRole('button', { name: 'Resend link' }).click(); await expect(page.getByRole('status')).toContainText('Check your inbox');
});

test('password confirmation feedback does not move the signup submit button during a click', async ({ page }) => {
  await fillRegistration(page, uniqueEmail());
  const button = page.locator('main form button[type=submit]');
  await page.waitForTimeout(650); const before = (await button.boundingBox())!;
  await page.locator('#confirmPassword').blur(); await page.waitForTimeout(350);
  const after = (await button.boundingBox())!; expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
});
