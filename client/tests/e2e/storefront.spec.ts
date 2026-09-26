import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('preferred_language', 'en');
    localStorage.setItem('blessp_cookie_consent', 'rejected');
    localStorage.setItem('blessp_mfa_reminded_at', String(Date.now()));
  });
});

async function fixture(request: APIRequestContext) {
  const response = await request.get('/api/v1/products?search=Classic%20Black%20Hoodie');
  expect(response.ok()).toBe(true);
  return (await response.json()).data[0];
}

test('product sharing metadata is present without JavaScript and stays correct after navigation', async ({ page, request }) => {
  const product = await fixture(request);
  const response = await request.get(`/products/${product.id}`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  // Parse an inert document: HTML entities must be decoded, scripts must not run.
  expect(await page.evaluate(markup => new DOMParser().parseFromString(markup, 'text/html').title, html)).toBe(`${product.name} — BLE$$ P`);
  expect(html).toContain('property="product:price:currency" content="CAD"');
  await page.goto(`/products/${product.id}`);
  await expect(page).toHaveTitle(`${product.name} — BLE$$ P`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', `${product.name} — BLE$$ P`);
  await page.getByRole('link', { name: 'Shop', exact: true }).first().click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/shop$/);
  await expect(page.locator('meta[property="product:price:amount"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
});

test('search traps keyboard focus, restores it and discards stale responses', async ({ page, request }) => {
  const product = await fixture(request);
  await page.route(url => url.pathname === '/api/v1/products' && url.searchParams.get('perPage') === '5', async route => {
    const query = new URL(route.request().url()).searchParams.get('search');
    if (query === 'old') await new Promise(resolve => setTimeout(resolve, 1000));
    await route.fulfill({ json: { data: [{ ...product, name: query === 'old' ? 'Old result' : 'New result' }] } });
  });
  await page.goto('/shop');
  const opener = page.getByRole('button', { name: 'Search', exact: true }); await opener.click();
  const dialog = page.getByRole('dialog', { name: /search/i });
  const input = dialog.getByRole('textbox'); await expect(input).toBeFocused();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: /close search/i })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(input).toBeFocused();
  const oldRequest = page.waitForRequest(req => req.url().includes('search=old'));
  await input.fill('old'); await oldRequest;
  await input.fill('new'); await expect(dialog.getByText('New result', { exact: true })).toBeVisible();
  await page.waitForTimeout(1100);
  await expect(dialog.getByText('Old result', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('New result', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('size guide works with keyboard, fits mobile and returns focus on Escape', async ({ page, request }) => {
  const product = await fixture(request);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/products/${product.id}`);
  const opener = page.getByRole('button', { name: /size guide/i }); await opener.click();
  const dialog = page.getByRole('dialog', { name: /size guide/i }); await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog.locator('..')).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await expect(dialog.getByRole('button', { name: /close size guide/i })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Bottoms', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(dialog.getByRole('button', { name: 'Bottoms', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
});

test('background video can be paused and resumed', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('video');
  const pause = page.getByRole('button', { name: 'Pause background video' });
  await expect(pause).toBeVisible({ timeout: 15000 });
  await expect(video).toHaveCSS('opacity', '1');
  await pause.click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.getByRole('button', { name: 'Play background video' }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
});

test('the first keyboard stop skips repeated navigation and focuses the main content', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.locator('main')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Skip to content/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

for (const mode of ['mobile', 'reduced-motion', 'save-data']) {
  test(`background video does not download in ${mode}`, async ({ page }) => {
    if (mode === 'mobile') await page.setViewportSize({ width: 360, height: 800 });
    if (mode === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (mode === 'save-data') await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
    const videos: string[] = [];
    page.on('request', request => { if (request.url().includes('/video/')) videos.push(request.url()); });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'BLE$$ P', exact: true })).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(page.locator('video source')).toHaveCount(0);
    await expect(page.locator('video')).toHaveCSS('opacity', '0');
    await expect(page.locator('.campaign-hero > img')).toBeVisible();
    expect(videos).toEqual([]);
  });
}

test('unknown routes return 404 and remain excluded from indexing after rendering', async ({ page }) => {
  const response = await page.goto('/missing-page');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('Page Not Found — BLE$$ P');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
});

for (const path of ['/', '/contact', '/signup', '/forgot-password', '/reset-password', '/compare', '/terms', '/return-policy', '/missing-page']) {
  test(`WCAG 2.2 AA checks on ${path}`, async ({ page }) => {
    await page.goto(path);
    if (path === '/') {
      // A streaming hero can keep the network busy after the page is usable.
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main a[href^="/products/"]').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
    } else await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) }))).toEqual([]);
  });
}
