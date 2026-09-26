import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../../server/node_modules/@prisma/client');
const argon2 = require('../../../server/node_modules/argon2');
const url = new URL(process.env.DATABASE_URL!);
if (!/_(test|audit|ci)$/.test(url.pathname)) throw new Error('Inventory tests require an isolated database.');
url.searchParams.set('schema', 'e2e');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const password = 'InventoryPassword123!';
const hash = argon2.hash(password);
const productIds: string[] = [];
const userIds: string[] = [];
async function fixture(page: Page, admin = true) {
  const user = await db.user.create({ data: { email: `inventory-${crypto.randomUUID()}@example.com`, passwordHash: await hash, firstName: 'Inventory', lastName: 'Tester', emailVerifiedAt: new Date(), isAdmin: admin } });
  userIds.push(user.id);
  const product = await db.product.create({ data: { name: `Inventory ${crypto.randomUUID()}`, price: 5000, category: 'hoodies', sizes: ['M'], colors: ['Black'], variants: { create: { size: 'M', color: 'Black', stock: 10, sku: `SKU-${crypto.randomUUID()}` } } }, include: { variants: true } });
  productIds.push(product.id);
  await page.goto('/signin'); await page.locator('#email').fill(user.email); await page.locator('#password').fill(password); await page.locator('main form button[type=submit]').click(); await expect(page).not.toHaveURL(/\/signin/);
  return { user, product, variant: product.variants[0] };
}
async function inventory(page: Page, name: string) {
  await page.goto('/admin/inventory'); await page.locator('#inventory-search').fill(name);
  const row = page.locator('main article').filter({ hasText: name }); await expect(row).toHaveCount(1);
  await expect(row.getByRole('button', { name: 'Adjust stock', exact: true })).toBeEnabled(); return row;
}
async function stock(id: string) { return (await db.productVariant.findUniqueOrThrow({ where: { id } })).stock; }
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('preferred_language')) localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
});
test.afterAll(async () => {
  await db.stockAdjustment.deleteMany({ where: { variant: { productId: { in: productIds } } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

test('admin adjusts available stock, filters by SKU and sees the recorded history', async ({ page }) => {
  const { product, variant } = await fixture(page);
  await page.goto('/admin'); await page.getByRole('link', { name: 'Stock management', exact: true }).click();
  await page.locator('#inventory-search').fill(variant.sku);
  const row = page.locator('main article').filter({ hasText: product.name }); await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Adjust stock', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button', { name: 'Save adjustment', exact: true })).toBeDisabled();
  await page.locator('#inventory-quantity').fill('3'); await page.locator('#inventory-reason').selectOption('count'); await page.locator('#inventory-note').fill('Warehouse count <script>inert</script>');
  await dialog.getByRole('button', { name: 'Save adjustment', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect.poll(() => stock(variant.id)).toBe(3);
  await page.locator('#inventory-status').selectOption('low'); await expect(row).toContainText('Low stock');
  await row.getByRole('button', { name: 'Manual history', exact: true }).click(); await expect(dialog).toContainText('10 → 3'); await expect(dialog).toContainText('Inventory Tester'); await expect(dialog).toContainText('Warehouse count <script>inert</script>');
  expect(await dialog.locator('script').count()).toBe(0);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Manual history', exact: true })).toBeFocused();
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#inventory-search').fill(product.name); await expect(row).toContainText('Low stock');
});

test('a stale count is refused and explicitly refreshed before a new adjustment', async ({ page }) => {
  const { product, variant } = await fixture(page); const row = await inventory(page, product.name);
  await row.getByRole('button', { name: 'Adjust stock', exact: true }).click();
  await db.productVariant.update({ where: { id: variant.id }, data: { stock: { decrement: 2 } } });
  await page.locator('#inventory-quantity').fill('15'); await page.getByRole('button', { name: 'Save adjustment', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible(); expect(await stock(variant.id)).toBe(8);
  await page.getByRole('button', { name: 'Reload current stock', exact: true }).click(); await expect(page.locator('#inventory-quantity')).toHaveValue('8');
  await page.locator('#inventory-quantity').fill('12'); await page.getByRole('button', { name: 'Save adjustment', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await stock(variant.id)).toBe(12); expect(await db.stockAdjustment.count({ where: { variantId: variant.id } })).toBe(1);
});

test('metadata edits preserve sales made while the product editor was open', async ({ page }) => {
  const { product, variant } = await fixture(page); await page.goto(`/admin/products/${product.id}/edit`);
  await expect(page.getByRole('spinbutton', { name: 'Stock M Black', exact: true })).toHaveValue('10');
  await db.productVariant.update({ where: { id: variant.id }, data: { stock: 9 } });
  await page.locator('#field-name').fill(`${product.name} renamed`); await page.locator('main form button[type=submit]').click(); await expect(page).toHaveURL(/\/admin\/products$/);
  expect(await stock(variant.id)).toBe(9); expect(await db.stockAdjustment.count({ where: { variantId: variant.id } })).toBe(0);
});

test('the product editor rejects changed stock when a concurrent sale made it stale', async ({ page }) => {
  const { product, variant } = await fixture(page); await page.goto(`/admin/products/${product.id}/edit`);
  const input = page.getByRole('spinbutton', { name: 'Stock M Black', exact: true }); await expect(input).toHaveValue('10');
  await db.productVariant.update({ where: { id: variant.id }, data: { stock: 9 } });
  await input.fill('20'); await page.locator('main form button[type=submit]').click();
  await expect(page.locator('main [role=alert]')).toContainText(/stock/i); expect(await stock(variant.id)).toBe(9);
  expect(await db.stockAdjustment.count({ where: { variantId: variant.id } })).toBe(0);
});

test('a lost adjustment response can be retried without a duplicate movement', async ({ page }) => {
  const { product, variant } = await fixture(page); const row = await inventory(page, product.name);
  const endpoint = `**/admin/inventory/${variant.id}/adjustments`; const keys: string[] = [];
  await page.route(endpoint, async route => {
    keys.push(route.request().postDataJSON().requestId);
    const response = await route.fetch();
    if (keys.length === 1) await route.abort('failed'); else await route.fulfill({ response });
  });
  await row.getByRole('button', { name: 'Adjust stock', exact: true }).click(); await page.locator('#inventory-quantity').fill('25');
  await page.getByRole('button', { name: 'Save adjustment', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Save adjustment', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]); expect(await stock(variant.id)).toBe(25);
  expect(await db.stockAdjustment.count({ where: { variantId: variant.id } })).toBe(1);
});

test('zero stock disables purchase in the storefront and can be replenished', async ({ page }) => {
  const { product, variant } = await fixture(page); const row = await inventory(page, product.name);
  await row.getByRole('button', { name: 'Adjust stock', exact: true }).click(); await page.locator('#inventory-quantity').fill('0');
  await page.locator('#inventory-reason').selectOption('damage'); await page.getByRole('button', { name: 'Save adjustment', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#inventory-status').selectOption('out'); await expect(row).toContainText('Out of stock');
  await page.goto(`/products/${product.id}`); await expect(page.locator('main')).toContainText(/out of stock/i);
  await expect(page.getByRole('button', { name: /out of stock/i }).first()).toBeDisabled();
  const refreshed = await inventory(page, product.name); await refreshed.getByRole('button', { name: 'Adjust stock', exact: true }).click(); await page.locator('#inventory-quantity').fill('6');
  await page.getByRole('button', { name: 'Save adjustment', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); expect(await stock(variant.id)).toBe(6);
});

test('inventory and its dialogs are accessible and fit a 320 px French viewport', async ({ page }, testInfo) => {
  const { product } = await fixture(page); await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => localStorage.setItem('preferred_language', 'fr')); await page.goto('/admin/inventory');
  await page.locator('#inventory-search').fill(product.name); const row = page.locator('main article').filter({ hasText: product.name });
  await expect(row.getByRole('button', { name: 'Ajuster le stock', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  expect((await page.locator('#inventory-search').boundingBox())!.width).toBeGreaterThanOrEqual(280);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('inventory-mobile-fr.png'), fullPage: true });
  const trigger = row.getByRole('button', { name: 'Ajuster le stock', exact: true }); await trigger.click(); await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('inventory-dialog-mobile-fr.png') }); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('an ordinary customer cannot open stock management', async ({ page }) => {
  await fixture(page, false); await page.goto('/admin/inventory'); await expect(page).not.toHaveURL(/\/admin\/inventory/);
  await expect(page.locator('#inventory-search')).toHaveCount(0);
});

test('large inventories and long adjustment histories stay paginated', async ({ page }) => {
  const { product, variant, user } = await fixture(page);
  await db.productVariant.createMany({ data: Array.from({ length: 26 }, (_, index) => ({ productId: product.id, size: `Archive-${index}`, color: 'Black', stock: index + 11 })) });
  await db.stockAdjustment.createMany({ data: Array.from({ length: 12 }, (_, index) => ({ variantId: variant.id, actorId: user.id, productName: product.name, size: 'M', color: 'Black', before: index, after: index + 1, reason: 'count', note: `Count ${index}`, createdAt: new Date(Date.now() - index * 1000) })) });
  await page.goto('/admin/inventory'); await page.locator('#inventory-search').fill(product.name); await expect(page.locator('main article')).toHaveCount(25);
  const pager = page.locator('main nav').last(); await pager.getByRole('button', { name: /2/ }).click(); await expect(page.locator('main article')).toHaveCount(2);
  await expect(page.locator('main')).toContainText(/not currently offered/i);
  await pager.getByRole('button', { name: /1/ }).click(); await expect(page.locator('main article')).toHaveCount(25);
  const row = page.locator('main article').filter({ hasText: variant.sku }); await row.getByRole('button', { name: 'Manual history', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.locator('ol li')).toHaveCount(10);
  await dialog.getByRole('button', { name: /2/ }).click(); await expect(dialog.locator('ol li')).toHaveCount(2); await expect(dialog).toContainText('Count 11');
});

test('inventory loading failures offer a working retry', async ({ page }) => {
  await fixture(page); let fail = true;
  await page.route('**/admin/inventory?*', route => fail ? route.abort('failed') : route.continue());
  await page.goto('/admin/inventory'); await expect(page.locator('main').getByRole('alert')).toBeVisible();
  fail = false; await page.locator('main').getByRole('alert').getByRole('button').click();
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0); await expect(page.locator('main article').first()).toBeVisible();
});
