import { test, expect } from '@playwright/test';
import { ShopPage } from './pages/shop.page';

test.describe('Shop', () => {
  test('shop page loads and displays the collection heading', async ({ page }) => {
    const shopPage = new ShopPage(page);
    await shopPage.navigate();

    await expect(shopPage.heading).toBeVisible();
  });

  test('displays products or empty state after loading', async ({ page }) => {
    const shopPage = new ShopPage(page);
    await shopPage.navigate();
    await shopPage.waitForProductsLoaded();

    // Either products or the empty state should be visible
    const productCount = await shopPage.getProductCount();
    if (productCount > 0) {
      await expect(shopPage.productCards.first()).toBeVisible();
    } else {
      // The empty state should be displayed
      const emptyMessage = page.locator('h3');
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('category filter buttons are visible on desktop', async ({ page }) => {
    const shopPage = new ShopPage(page);
    await shopPage.navigate();

    // Desktop category buttons should include All, Hoodies, Pants, Sets
    const buttons = page.locator('.hidden.gap-2.sm\\:flex button');
    await expect(buttons).toHaveCount(4);
  });

  test('clicking a category updates the URL', async ({ page }) => {
    const shopPage = new ShopPage(page);
    await shopPage.navigate();

    // Click on a specific category (Hoodies)
    const hoodiesButton = page.locator('.hidden.gap-2.sm\\:flex button').nth(1);
    await hoodiesButton.click();

    await expect(page).toHaveURL(/category=Hoodies/);
  });

  test('product detail page loads when clicking a product', async ({ page }) => {
    const shopPage = new ShopPage(page);
    await shopPage.navigate();
    await shopPage.waitForProductsLoaded();

    const productCount = await shopPage.getProductCount();
    if (productCount === 0) {
      test.skip();
      return;
    }

    await shopPage.clickFirstProduct();
    await expect(page).toHaveURL(/\/products\/.+/);

    // Product detail page should have a heading
    const productHeading = page.locator('h1');
    await expect(productHeading).toBeVisible();
  });

  test('search page loads when navigating to /search', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('/search');
  });
});
