import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('preferred_language', 'en');
    localStorage.setItem('blessp_cookie_consent', 'rejected');
  });
});

test('loads filter facets once for both desktop and mobile controls', async ({ page }) => {
  let requests = 0;
  page.on('request', r => { if (r.url().endsWith('/products/filters')) requests++; });
  await page.goto('/shop');
  await expect(page.getByRole('spinbutton', { name: 'Minimum price' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(S|M|L|XL)$/ })).toHaveText(['S', 'M', 'L', 'XL']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('spinbutton', { name: 'Minimum price' })).toBeVisible();
  expect(requests).toBe(1);
});

test('delayed facets do not move or resize the product grid on desktop or mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/products/filters', async route => { await held; await route.continue(); });
    try {
      await page.setViewportSize({ width, height: 900 }); await page.goto('/shop');
      const card = page.getByRole('article').first(); await expect(card).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (width < 1024) await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeDisabled();
      const before = (await card.boundingBox())!;
      release();
      if (width >= 1024) await expect(page.getByRole('spinbutton', { name: 'Minimum price' })).toBeVisible();
      else await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeEnabled();
      const after = (await card.boundingBox())!;
      expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
    } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
  }
});

test('debounces prices and keeps the existing cards mounted while refreshing', async ({ page }) => {
  // Install before application timers; fixed instants avoid host/browser clock drift.
  await page.clock.install({ time: new Date('2026-01-01T08:00:00Z') });
  const prices: string[] = [];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/products?*', async route => {
    const price = new URL(route.request().url()).searchParams.get('minPrice');
    if (price) { prices.push(price); await held; }
    await route.continue();
  });
  await page.goto('/shop');
  const cards = page.getByRole('region', { name: 'Collection' }).locator('a[href^="/products/"]');
  await expect(cards.first()).toBeVisible();
  await cards.first().evaluate(element => element.setAttribute('data-retained-card', 'yes'));
  try {
    await page.clock.pauseAt(new Date('2026-01-01T10:00:00Z'));
    const minimum = page.getByRole('spinbutton', { name: 'Minimum price' });
    for (const value of ['1', '12', '123']) {
      await minimum.fill(value);
      await expect(minimum).toHaveValue(value);
      await expect(page).toHaveURL(new RegExp(`minPrice=${Number(value) * 100}(?:&|$)`));
      await page.clock.runFor(100);
    }
    expect(prices).toEqual([]);
    await page.clock.runFor(201);
    await expect.poll(() => prices).toEqual(['12300']);
    await expect(cards.first()).toHaveAttribute('data-retained-card', 'yes');
    await expect(page.getByRole('region', { name: 'Collection' })).toHaveAttribute('aria-busy', 'true');
  } finally { release(); await page.clock.resume(); }
  await expect(page.getByRole('region', { name: 'Collection' })).toHaveAttribute('aria-busy', 'false');
});

test('price filters preserve fast keystrokes and browser history restores their values', async ({ page }) => {
  await page.goto('/shop');
  const minimum = page.getByRole('spinbutton', { name: 'Minimum price' });
  const maximum = page.getByRole('spinbutton', { name: 'Maximum price' });
  await minimum.pressSequentially('123');
  await expect(minimum).toHaveValue('123');
  await expect(page).toHaveURL(/minPrice=12300/);
  await maximum.pressSequentially('456');
  await expect(maximum).toHaveValue('456');
  await expect(page).toHaveURL(/maxPrice=45600/);
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await minimum.fill('12');
  await expect(page).toHaveURL(/minPrice=1200/);
  await page.goBack();
  await expect(minimum).toHaveValue('123');
  await expect(maximum).toHaveValue('456');
  await page.goForward();
  await expect(minimum).toHaveValue('12');
});

test('cancels stale catalogue requests and never replaces the newest category', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let delayed = false;
  const aborted: string[] = [];
  page.on('requestfailed', r => aborted.push(r.url()));
  await page.route('**/api/v1/products?*', async route => {
    if (new URL(route.request().url()).searchParams.get('category') === 'hoodies') {
      const response = await route.fetch(); delayed = true; await held;
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  await page.goto('/shop');
  await expect(page.locator('main h2').filter({ hasText: 'Classic Black Hoodie' })).toBeVisible();
  try {
    await page.getByRole('button', { name: 'Hoodies', exact: true }).click();
    await expect.poll(() => delayed).toBe(true);
    await page.getByRole('button', { name: 'Pants', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Collection' })).toHaveAttribute('aria-busy', 'false');
    await expect.poll(() => aborted.some(url => url.includes('category=hoodies'))).toBe(true);
  } finally { release(); }
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page.locator('main h2').filter({ hasText: 'Classic Black Hoodie' })).toHaveCount(0);
  await expect(page).toHaveURL(/category=Pants/);
});

test('browser history restores both filter controls and matching products', async ({ page }) => {
  await page.goto('/shop');
  const black = page.getByRole('button', { name: 'Black', exact: true });
  const blue = page.getByRole('button', { name: 'Blue', exact: true });
  await black.click(); await expect(page).toHaveURL(/colors=Black/);
  await blue.click(); await expect(page).toHaveURL(/colors=Black%2CBlue/);
  await page.goBack();
  await expect(black).toHaveAttribute('aria-pressed', 'true');
  await expect(blue).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('region', { name: 'Collection' })).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('main h2').filter({ hasText: 'Ocean Blue Hoodie' })).toHaveCount(0);
  await page.goForward(); await expect(blue).toHaveAttribute('aria-pressed', 'true');
});

test('failed refresh preserves the catalogue and retry recovers', async ({ page }) => {
  await page.goto('/shop');
  const card = page.locator('main h2').filter({ hasText: 'Classic Black Hoodie' });
  await expect(card).toBeVisible();
  await page.route('**/api/v1/products?*', route => route.fulfill({ status: 503, json: { error: { message: 'Synthetic outage' } } }));
  await page.getByRole('button', { name: 'Hoodies', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to load products');
  await expect(card).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Collection' })).toHaveAttribute('aria-busy', 'false');
});

test('large catalogue pagination stays bounded, accessible and usable at 320px', async ({ page, request }) => {
  const sample = (await (await request.get('/api/v1/products?perPage=1')).json()).data[0];
  await page.route('**/api/v1/products?*', route => route.fulfill({ json: {
    data: [sample], pagination: { page: Number(new URL(route.request().url()).searchParams.get('page')), perPage: 12, totalItems: 120000, totalPages: 10000 },
  } }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/shop?page=5000');
  const pagination = page.getByRole('navigation', { name: 'Product pages' });
  await expect(pagination.getByRole('button')).toHaveCount(5);
  await expect(pagination.getByRole('button', { name: 'Page 5000', exact: true })).toHaveAttribute('aria-current', 'page');
  await pagination.getByRole('button', { name: 'Page 5001', exact: true }).click();
  await expect(page).toHaveURL(/page=5001/);
  await expect(pagination.getByRole('button', { name: 'Page 5001', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const result = await new AxeBuilder({ page }).include('nav[aria-label="Product pages"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('view all clears category and advanced filters together after an empty result', async ({ page }) => {
  await page.goto('/shop?category=Pants&minPrice=999999&colors=missing');
  await page.getByRole('button', { name: 'View All Products', exact: true }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole('spinbutton', { name: 'Minimum price' })).toHaveValue('');
  await expect(page.locator('main h2').filter({ hasText: 'Classic Black Hoodie' })).toBeVisible();
});

test('product and stock requests start independently, without a network waterfall', async ({ page, request }) => {
  const sample = (await (await request.get('/api/v1/products?perPage=1')).json()).data[0];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let variantsStarted = false;
  page.on('request', r => { if (r.url().endsWith(`/products/${sample.id}/variants`)) variantsStarted = true; });
  await page.route(`**/api/v1/products/${sample.id}`, async route => { await held; await route.continue(); });
  await page.goto(`/products/${sample.id}`);
  try { await expect.poll(() => variantsStarted).toBe(true); } finally { release(); }
  await expect(page.getByRole('heading', { name: sample.name, exact: true })).toBeVisible();
});
