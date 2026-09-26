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
    const signedOut = page.waitForResponse(response => response.url().endsWith('/auth/logout') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /sign out/i }).first().click(); expect((await signedOut).ok()).toBe(true);
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
