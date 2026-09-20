import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Account email tests require an isolated database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = 'LocalizedBrowserPassword123!';
async function emailFor(email: string, path: string) {
  const row = await db.emailOutbox.findFirstOrThrow({ where: { AND: [{ payload: { path: ['to'], equals: email } }, { payload: { path: ['html'], string_contains: path } }] }, orderBy: { createdAt: 'desc' } });
  return row.payload as { html: string; subject: string };
}
async function followEmail(page: Page, html: string, oppositeLanguage: string) {
  const href = html.match(/href="([^"]+)"/)![1].replaceAll('&amp;', '&');
  const link = new URL(href);
  await page.evaluate(language => localStorage.setItem('preferred_language', language), oppositeLanguage);
  await page.goto('about:blank');
  // Use the link's complete path/query/fragment on the isolated test origin.
  await page.goto(link.pathname + link.search + link.hash);
}
async function submit(page: Page) { await page.locator('main form button[type=submit]').click(); }
test.afterAll(async () => db.$disconnect());
for (const locale of ['fr', 'en']) test(`real signup, email link, reset and sign-in keep the email language (${locale})`, async ({ page }) => {
  test.setTimeout(60000);
  const email = `account-email-${crypto.randomUUID()}@example.com`;
  const other = locale === 'fr' ? 'en' : 'fr';
  await page.addInitScript(() => { localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/signup?lng=${locale}`);
  for (const [id, value] of Object.entries({ firstName: 'Élodie', lastName: 'Test', email, password, confirmPassword: password })) await page.locator(`#${id}`).fill(value);
  const registered = page.waitForResponse(r => r.url().endsWith('/auth/register') && r.request().method() === 'POST');
  await submit(page); expect((await registered).status()).toBe(202);
  await expect(page).toHaveURL(/\/verify-email$/);
  const verification = await emailFor(email, '/verify-email'); expect(verification.html).toContain(`<html lang="${locale}">`);
  await followEmail(page, verification.html, other);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await page.getByRole('button', { name: locale === 'fr' ? 'Confirmer mon adresse' : 'Confirm my email' }).click();
  await expect(page.getByRole('status')).toContainText(locale === 'fr' ? 'Adresse vérifiée' : 'Email verified');
  expect((await emailFor(email, '/shop')).html).toContain(`<html lang="${locale}">`);
  await page.goto('/forgot-password'); await page.locator('#email').fill(email);
  const requested = page.waitForResponse(r => r.url().endsWith('/auth/forgot-password') && r.request().method() === 'POST');
  await submit(page); expect((await requested).ok()).toBe(true);
  const reset = await emailFor(email, '/reset-password'); expect(reset.html).toContain(`<html lang="${locale}">`);
  await followEmail(page, reset.html, other); await expect(page.locator('html')).toHaveAttribute('lang', locale);
  const next = 'NewLocalizedPassword123!';
  await page.locator('#password').fill(next); await page.locator('#confirmPassword').fill(next);
  const changed = page.waitForResponse(r => r.url().endsWith('/auth/reset-password') && r.request().method() === 'POST');
  await submit(page); expect((await changed).ok()).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.goto('/signin'); await page.locator('#email').fill(email); await page.locator('#password').fill(next); await submit(page);
  await expect(page).not.toHaveURL(/\/signin/); await page.goto('/profile'); await expect(page.locator('main')).toContainText(email);
});
