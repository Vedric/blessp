import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const argon2 = require('../../../server/node_modules/argon2');
const database = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(database.pathname)) throw new Error('Session tests require an isolated database.');
database.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: database.toString() } } });
const password = 'ResiliencePassword123!';
const hash = argon2.hash(password);
const users: string[] = [];
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
});
test.afterAll(async () => { await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); });
async function login(page: Page) {
  const user = await db.user.create({ data: { email: `session-${crypto.randomUUID()}@example.com`, passwordHash: await hash, firstName: 'Session', lastName: 'Tester', emailVerifiedAt: new Date() } });
  users.push(user.id);
  await page.goto('/profile', { waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL(/\/signin/);
  await page.locator('#email').fill(user.email); await page.locator('#password').fill(password);
  await page.locator('main form button[type=submit]').click(); await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator('main')).toContainText(user.email);
  return user;
}

test('three tabs can renew the shared session concurrently and reloads after logout are anonymous', async ({ page, context }) => {
  const user = await login(page);
  const second = await context.newPage(), third = await context.newPage();
  try {
    // Background tabs can delay the load event; assert the usable authenticated UI.
    await Promise.all([page.reload({ waitUntil: 'domcontentloaded' }), second.goto('/profile', { waitUntil: 'domcontentloaded' }), third.goto('/profile', { waitUntil: 'domcontentloaded' })]);
    for (const tab of [page, second, third]) { await expect(tab).toHaveURL(/\/profile$/); await expect(tab.locator('main')).toContainText(user.email); }
    await Promise.all([page, second, third].map(tab => tab.reload({ waitUntil: 'domcontentloaded' })));
    for (const tab of [page, second, third]) await expect(tab.locator('main')).toContainText(user.email);
    for (const tab of [second, third]) await tab.evaluate(() => { sessionStorage.setItem('blessp_checkout_pending', 'synthetic'); sessionStorage.setItem('blessp_checkout_attempt', 'synthetic'); });
    const signedOut = page.waitForResponse(response => response.url().endsWith('/auth/logout') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /sign out/i }).first().click(); expect((await signedOut).ok()).toBe(true);
    for (const tab of [second, third]) { await expect(tab).toHaveURL(/\/signin/); await expect(tab.locator('main')).not.toContainText(user.email); }
    for (const tab of [second, third]) expect(await tab.evaluate(() => [sessionStorage.getItem('blessp_checkout_pending'), sessionStorage.getItem('blessp_checkout_attempt')])).toEqual([null, null]);
    await Promise.all([second, third].map(tab => tab.reload({ waitUntil: 'domcontentloaded' })));
    for (const tab of [second, third]) { await expect(tab).toHaveURL(/\/signin/); await expect(tab.locator('main')).not.toContainText(user.email); }
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
  } finally { await second.close(); await third.close(); }
});

test('a transient refresh network failure hides private content and a later navigation recovers', async ({ page }) => {
  const user = await login(page);
  await page.route('**/api/v1/auth/refresh', route => route.abort('failed'));
  await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL(/\/signin/); await expect(page.locator('main')).not.toContainText(user.email);
  await page.unroute('**/api/v1/auth/refresh');
  await page.goto('/profile', { waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL(/\/profile$/); await expect(page.locator('main')).toContainText(user.email);
});

for (const failure of ['network abort', 'lost logout response', 'logout server error'] as const) test(`${failure}: a failed logout remains anonymous after reloading and reconnecting`, async ({ page }) => {
  const user = await login(page);
  let faultInjected = false;
  await page.route('**/api/v1/auth/logout', async route => {
    if (failure === 'logout server error') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Synthetic outage' } }) });
    else {
      if (failure === 'lost logout response') await route.fetch();
      await route.abort('failed');
    }
    faultInjected = true;
  });
  await page.getByRole('button', { name: /sign out/i }).first().click();
  await expect(page).toHaveURL(/\/signin/);
  await expect.poll(() => faultInjected).toBe(true);
  await page.unroute('**/api/v1/auth/logout');
  await page.goto('/profile', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.locator('main')).not.toContainText(user.email);
  expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
});

test('an ongoing logout outage blocks refresh and sign-in, then a deliberate login recovers', async ({ page, context }) => {
  await context.addInitScript(() => Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: undefined }));
  const user = await login(page);
  const refreshes: string[] = [];
  context.on('request', request => { if (request.url().endsWith('/auth/refresh')) refreshes.push(request.url()); });
  await context.route('**/api/v1/auth/logout', route => route.abort('failed'));
  await page.getByRole('button', { name: /sign out/i }).first().click();
  await expect(page).toHaveURL(/\/signin/);
  await page.goto('/profile', { waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL(/\/signin/);
  await expect(page.locator('main')).not.toContainText(user.email);
  await page.locator('#email').fill(user.email); await page.locator('#password').fill(password);
  await page.locator('main form button[type=submit]').click();
  await expect(page.locator('main')).toContainText('previous sign-out could not be completed');
  expect(refreshes).toHaveLength(0);
  await context.unroute('**/api/v1/auth/logout');
  await page.locator('main form button[type=submit]').click();
  await expect(page).toHaveURL(/\/profile$/); await expect(page.locator('main')).toContainText(user.email);
  await page.reload({ waitUntil: 'domcontentloaded' }); await expect(page.locator('main')).toContainText(user.email);
  expect(refreshes.length).toBeGreaterThan(0);
});
