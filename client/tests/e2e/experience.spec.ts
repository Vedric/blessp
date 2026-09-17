import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import crypto from 'node:crypto';

async function preferences(page: Page, language = 'en', consent = 'rejected') {
  await page.addInitScript(({ language, consent }) => {
    localStorage.setItem('preferred_language', language);
    if (!localStorage.getItem('blessp_cookie_consent')) localStorage.setItem('blessp_cookie_consent', consent);
  }, { language, consent });
}
async function sample(page: Page) {
  const response = await page.request.get('/api/v1/products?search=Classic%20Black%20Hoodie&perPage=100');
  const product = (await response.json()).data.find((product: { name: string }) => product.name === 'Classic Black Hoodie'); expect(product).toBeTruthy(); return product;
}
async function fits(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }
async function accessible(page: Page, selector?: string) {
  await page.waitForTimeout(1200);
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  if (selector) builder = builder.include(selector);
  const results = await builder.analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
}

test.beforeEach(async ({ page }) => preferences(page));

test('editorial collection links open the matching catalogue and home size guide works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BLE$$ P', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Shopping services' }).getByRole('button', { name: 'Size Guide' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Shopping services' }).getByRole('button', { name: 'Size Guide' })).toBeFocused();
  await page.locator('main').getByRole('link', { name: 'Hoodies', exact: true }).click();
  await expect(page).toHaveURL(/category=Hoodies/);
  await expect(page.getByRole('button', { name: 'Hoodies', exact: true })).toHaveClass(/bg-neutral-900/);
  await page.goto('/shop?category=hoodies');
  await expect(page.getByRole('button', { name: 'Hoodies', exact: true })).toHaveClass(/bg-neutral-900/);
});

test('home featured products recover from an outage without losing collection navigation', async ({ page }) => {
  await page.route('**/api/v1/products/featured', route => route.fulfill({ status: 503, json: { error: { message: 'Synthetic outage' } } }));
  await page.goto('/'); await expect(page.getByRole('alert')).toContainText('Unable to load products');
  await expect(page.getByRole('link', { name: 'Shop Collection', exact: true })).toBeVisible();
  await page.unrouteAll(); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('article').first()).toBeVisible(); await expect(page.getByRole('alert')).toHaveCount(0);
});

test('hero playback stops on mobile resize and restarts when desktop returns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  const video = page.locator('video');
  await expect(page.getByRole('button', { name: 'Pause background video' })).toBeVisible({ timeout: 15000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(video.locator('source')).toHaveCount(0);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('button', { name: 'Pause background video' })).toBeVisible({ timeout: 15000 });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
});

test('newsletter reports errors, retains input and prevents duplicate in-flight submissions', async ({ page }) => {
  let calls = 0; let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/newsletter/subscribe', async route => {
    calls++; if (calls === 1) await route.fulfill({ status: 503, json: { error: { message: 'Synthetic outage' } } });
    else { await held; await route.continue(); }
  });
  await page.goto('/'); const footer = page.locator('footer');
  const email = `experience-${crypto.randomUUID()}@example.com`;
  await footer.getByRole('textbox', { name: 'Email' }).fill(email); await footer.getByRole('checkbox').check();
  await footer.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(footer.getByRole('alert')).toContainText('could not process');
  await expect(footer.getByRole('textbox')).toHaveValue(email);
  try {
    await footer.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(footer.getByRole('button', { name: 'Loading...' })).toBeDisabled();
    await footer.locator('form').dispatchEvent('submit');
    expect(calls).toBe(2); await fits(page);
  } finally { release(); }
  await expect(footer.getByRole('status')).toContainText('confirm your subscription');
  await expect(footer.getByRole('textbox')).toHaveValue(''); expect(calls).toBe(2);
});

test('collapsed mobile footer sections do not expose hidden links to keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await page.goto('/');
  const footer = page.locator('footer'); const shop = footer.getByRole('button', { name: 'Shop', exact: true });
  await shop.click(); await expect(shop).toHaveAttribute('aria-expanded', 'true');
  await shop.click(); await expect(shop).toHaveAttribute('aria-expanded', 'false');
  await expect(footer.getByRole('link', { name: 'All Products' })).toBeHidden();
  await page.keyboard.press('Tab'); await expect(footer.getByRole('button', { name: 'Customer Care', exact: true })).toBeFocused();
  await footer.getByRole('button', { name: 'Stay Connected', exact: true }).click();
  await expect(footer.getByRole('textbox', { name: 'Email' })).toBeVisible(); await fits(page); await accessible(page, 'footer');
});

test('cookie choices can be reopened and tracking consent revoked with focus restored', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('blessp_cookie_consent', 'accepted'));
  const product = await sample(page); await page.goto(`/products/${product.id}`);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('recentlyViewed'))).toContain(product.id);
  const preferencesButton = page.locator('footer').getByRole('button', { name: 'Cookie preferences', exact: true });
  await preferencesButton.click(); const banner = page.getByRole('region', { name: 'Cookie preferences', exact: true });
  await expect(banner.getByRole('button', { name: 'Reject', exact: true })).toBeFocused();
  await banner.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(banner).toBeHidden(); await expect(preferencesButton).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('blessp_cookie_consent'))).toBe('rejected');
  expect(await page.evaluate(() => localStorage.getItem('recentlyViewed'))).toBeNull();
});

test('early cookie preferences do not reopen after the initial prompt delay', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('blessp_cookie_consent'));
  await page.clock.install({ time: new Date('2026-09-17T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-17T00:00:01Z'));
  await page.goto('/');
  // Dispatch clicks while the clock is paused to exercise the race before
  // the 1.5-second initial prompt, independent of animation/runner speed.
  await page.locator('footer').getByRole('button', { name: 'Cookie preferences', exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  const region = page.getByRole('region', { name: 'Cookie preferences', exact: true });
  await region.getByRole('button', { name: 'Reject', exact: true }).evaluate((button: HTMLButtonElement) => button.click());
  await page.clock.runFor(2500);
  await expect(region).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('blessp_cookie_consent'))).toBe('rejected');
});

for (const language of ['en', 'fr']) test(`product gallery supports thumbnails, arrows, zoom and focus restoration (${language})`, async ({ page }) => {
  await preferences(page, language); await page.setViewportSize({ width: 320, height: 740 });
  const product = await sample(page); await page.goto(`/products/${product.id}`);
  await page.getByRole('button', { name: 'Photo 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Photo 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const open = page.getByRole('button', { name: language === 'en' ? `Enlarge photos of ${product.name}` : `Agrandir les photos de ${product.name}`, exact: true });
  await open.click(); const dialog = page.getByRole('dialog', { name: product.name, exact: true });
  await expect(dialog.getByRole('status')).toHaveText(`2 / ${product.images.length}`);
  await page.keyboard.press('ArrowRight'); await expect(dialog.getByRole('status')).toHaveText(`3 / ${product.images.length}`);
  await dialog.getByRole('button', { name: language === 'en' ? 'Zoom in' : 'Zoom avant', exact: true }).click();
  await expect(dialog.getByRole('button', { name: language === 'en' ? 'Zoom out' : 'Zoom arrière', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await fits(page); await accessible(page, '[role=dialog]');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(open).toBeFocused();
});

test('search reaches results beyond the first 24 and restores pagination through history', async ({ page }) => {
  const product = await sample(page);
  await page.route('**/api/v1/products?*', route => {
    const params = new URL(route.request().url()).searchParams; const current = Number(params.get('page') || 1);
    const data = Array.from({ length: current === 3 ? 2 : 24 }, (_, index) => ({ ...product, id: crypto.randomUUID(), name: `Result ${(current - 1) * 24 + index + 1}` }));
    return route.fulfill({ json: { data, pagination: { page: current, perPage: 24, totalItems: 50, totalPages: 3 } } });
  });
  await page.goto('/search?q=example'); await expect(page.getByRole('article')).toHaveCount(24);
  await page.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Result 25', exact: true })).toBeVisible(); await expect(page).toHaveURL(/q=example&page=2/);
  await page.goBack(); await expect(page.getByRole('link', { name: 'Result 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Page 3', exact: true }).click(); await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Search our collection...' }).fill('new query');
  await expect(page).toHaveURL(/q=new\+query$/); await expect(page.getByRole('article')).toHaveCount(24);
});

test('product quantity follows available variant stock when the size changes', async ({ page }) => {
  const product = await sample(page);
  await page.route(`**/api/v1/products/${product.id}/variants`, async route => {
    const response = await route.fetch(); const body = await response.json();
    body.data = product.sizes.flatMap((size: string) => product.colors.map((color: string) => ({ id: `${size}-${color}`, productId: product.id, size, color, stock: size === 'M' ? 1 : 2, sku: null })));
    await route.fulfill({ json: body });
  });
  await page.goto(`/products/${product.id}`);
  const more = page.getByRole('button', { name: 'Increase quantity', exact: true });
  await more.click(); await expect(more).toBeDisabled();
  await page.getByRole('button', { name: 'M', exact: true }).click(); await expect(more).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Decrease quantity', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^Add to cart$/i }).first().click();
  await expect(page.getByText(/added to cart/i).first()).toBeVisible();
});

test('missing inventory cannot be purchased and a stock outage can be retried', async ({ page }) => {
  const product = await sample(page);
  let unavailable = false;
  let restored = false;
  await page.route(`**/api/v1/products/${product.id}/variants`, async route => {
    if (restored) return route.continue();
    await route.fulfill(unavailable ? { status: 503, json: { message: 'Inventory temporarily unavailable' } } : { json: { data: [] } });
  });
  await page.goto(`/products/${product.id}`);
  await expect(page.getByRole('button', { name: 'Out of Stock', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Increase quantity', exact: true })).toBeDisabled();
  unavailable = true; await page.reload();
  await expect(page.getByRole('alert')).toContainText('Unable to check availability');
  restored = true;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add to Cart', exact: true }).first()).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('product cards retain a usable link and price when an image is unavailable', async ({ page }) => {
  const product = await sample(page);
  await page.route('**/api/v1/products/featured', route => route.fulfill({ json: { data: [{ ...product, picture: '/missing-experience-photo.png', images: [] }] } }));
  await page.goto('/'); await page.getByRole('article').first().scrollIntoViewIfNeeded(); await expect(page.getByText('Image unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').getByRole('link', { name: product.name, exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toContainText('$');
});

test('guest order status and refunds are translated and readable on mobile', async ({ page }) => {
  await preferences(page, 'fr'); await page.setViewportSize({ width: 320, height: 740 });
  await page.route('**/api/v1/orders/guest/lookup', route => route.fulfill({ json: { data: { orderNumber: 'BLP-EXPERIENCE', status: 'delivered', paymentStatus: 'partially_refunded', totalCents: 12000, refundedCents: 2000, items: [{ id: '1', productName: 'Classic Black Hoodie', quantity: 1 }] } } }));
  await page.goto('/order-status'); await page.getByLabel('Numéro de commande').fill('BLP-EXPERIENCE'); await page.locator('#guest-order-email').fill('guest@example.com'); await page.getByRole('button', { name: 'Consulter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'BLP-EXPERIENCE', exact: true })).toBeVisible();
  await expect(page.locator('[aria-current=step]')).toContainText('Livrée');
  await expect(page.locator('main')).toContainText('Remboursée en partie'); await fits(page); await accessible(page, 'main');
});

for (const width of [320, 1440]) test(`French editorial pages and galleries fit ${width}px with accessible controls`, async ({ page }, info) => {
  await preferences(page, 'fr'); await page.setViewportSize({ width, height: 900 });
  const product = await sample(page);
  for (const [index, route] of ['/', '/shop', `/products/${product.id}`, '/search?q=Hoodie', '/order-status'].entries()) {
    await page.goto(route); await page.locator('main h1').waitFor();
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 700) { await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y); await page.waitForTimeout(60); }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await fits(page); await accessible(page);
    await page.screenshot({ path: info.outputPath(`editorial-${width}-${index}.png`), fullPage: true });
  }
});

test('FAQ links land on the actual questions section', async ({ page }) => {
  await page.goto('/'); await page.getByRole('navigation', { name: 'Shopping services' }).getByRole('link', { name: 'Questions & delivery' }).click();
  await expect(page).toHaveURL(/\/contact#faq$/);
  await expect(page.locator('#faq')).toBeFocused();
  await expect.poll(async () => (await page.locator('#faq').boundingBox())?.y).toBeLessThan(150);
});

test('sign-in returns to the protected page originally requested', async ({ page }) => {
  await page.goto('/profile/orders'); await expect(page).toHaveURL(/\/signin$/);
  await page.locator('#email').fill('e2e-admin@example.com'); await page.locator('#password').fill('E2EAdminPassword123!');
  await page.locator('main form button[type=submit]').click(); await expect(page).toHaveURL(/\/profile\/orders$/);
});

test('sign-in refuses an external destination in router history', async ({ page }) => {
  await page.goto('/signin');
  await page.evaluate(() => history.replaceState({ ...history.state, usr: { from: { pathname: '//127.0.0.1:49999' } } }, ''));
  await page.reload();
  await page.locator('#email').fill('e2e-admin@example.com'); await page.locator('#password').fill('E2EAdminPassword123!');
  await page.locator('main form button[type=submit]').click(); await expect(page).toHaveURL('http://127.0.0.1:3107/');
});
