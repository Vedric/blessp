// Repeatable local browser measurements; use the optimized isolated build.
const { chromium } = require('../client/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3107';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local measurements only');
const output = process.argv[2];
if (!output) throw new Error('Pass an output JSON path');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      localStorage.setItem('preferred_language', 'en');
      localStorage.setItem('blessp_cookie_consent', 'rejected');
    });
    let filtersRequests = 0;
    const priceRequests = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('/products/filters')) filtersRequests++;
      if (url.pathname.endsWith('/products') && url.searchParams.has('minPrice')) priceRequests.push(url.searchParams.get('minPrice'));
    });
    await page.route('**/api/v1/products?*', async route => {
      await new Promise(resolve => setTimeout(resolve, 250));
      await route.continue().catch(() => {});
    });
    await page.goto('/shop');
    await page.locator('main h2').filter({ hasText: /Hoodie|Pants|Set/ }).first().waitFor();
    await page.waitForTimeout(1200);
    const beforeCards = await page.locator('main a[href^="/products/"]').count();
    const input = page.getByRole('spinbutton', { name: 'Minimum price' });
    await input.pressSequentially('123', { delay: 80 });
    const duringCards = await page.locator('main a[href^="/products/"]').count();
    await page.waitForTimeout(1300);
    await page.unroute('**/api/v1/products?*');
    const response = await page.request.get('/api/v1/products?perPage=1');
    const product = (await response.json()).data[0];
    const starts = {};
    await page.route('**/api/v1/products/' + product.id + '**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith(product.id)) starts.product = performance.now();
      if (pathname.endsWith('/variants')) starts.variants = performance.now();
      await new Promise(resolve => setTimeout(resolve, 200));
      await route.continue().catch(() => {});
    });
    await page.goto('/products/' + product.id);
    await page.getByRole('heading', { name: product.name, exact: true }).waitFor();
    await page.waitForTimeout(300);
    await page.unrouteAll({ behavior: 'wait' });
    await page.route('**/api/v1/products?*', route => route.fulfill({ json: {
      data: [product], pagination: { page: 500, perPage: 12, totalPages: 1000, totalItems: 12000 },
    } }));
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/shop?page=500');
    await page.locator('main a[href^="/products/"]').first().waitFor();
    await page.waitForTimeout(500);
    const numericButtons = await page.getByRole('button').filter({ hasText: /^\d+$/ }).count();
    const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const result = { date: new Date().toISOString(), conditions: { browser: browser.version(), catalogueDelayMs: 250, productDelayMs: 200, typed: '123', keystrokeDelayMs: 80 }, filtersRequests, priceRequests, beforeCards, duringCards, productVariantsStartGapMs: Math.round(starts.variants - starts.product), pagination: { pages: 1000, numericButtons, overflowPx } };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
