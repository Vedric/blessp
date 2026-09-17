import { test, expect } from '@playwright/test';
for (const route of ['/admin/inventory', '/admin/contact']) {
  test(`direct loading ${route} returns a private HTML document and redirects anonymous visitors`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['x-robots-tag']).toBe('noindex, follow');
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('main form')).toBeVisible();
    const api = await page.request.get('/api/v1' + route);
    expect(api.status()).toBe(401);
  });
}
