import { test, expect } from '@playwright/test';

// The privacy policy is a public, statically routed page. Language is resolved
// from the `preferred_language` localStorage key the app's detector reads on
// init, so we seed it before navigation to render each locale.

test.describe('Privacy policy', () => {
  test('renders in English at /privacy', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('preferred_language', 'en');
    });

    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  });

  test('renders in French at /privacy', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('preferred_language', 'fr');
    });

    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' }),
    ).toBeVisible();
  });
});
