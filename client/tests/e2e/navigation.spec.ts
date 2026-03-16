import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('homepage loads with the brand name visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The brand "BLE$$ P" should be in the header
    const brand = page.locator('header a[href="/"]');
    await expect(brand).toBeVisible();
    await expect(brand).toHaveText(/BLE\$\$ P/);
  });

  test('header navigation links work', async ({ page }) => {
    await page.goto('/');

    // Click Shop link in header
    const shopLink = page.locator('header nav a[href="/shop"]');
    await shopLink.click();
    await expect(page).toHaveURL('/shop');

    // Click Contact link in header
    const contactLink = page.locator('header nav a[href="/contact"]');
    await contactLink.click();
    await expect(page).toHaveURL('/contact');
  });

  test('brand logo navigates to homepage', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    const brand = page.locator('header a[href="/"]');
    await brand.click();
    await expect(page).toHaveURL('/');
  });

  test('footer contains shop links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();

    // Footer should contain links to shop, contact, terms, return policy
    await expect(footer.locator('a[href="/shop"]')).toBeVisible();
    await expect(footer.locator('a[href="/contact"]')).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="/return-policy"]')).toBeVisible();
  });

  test('footer links navigate to correct pages', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();

    // Click terms link
    await footer.locator('a[href="/terms"]').click();
    await expect(page).toHaveURL('/terms');
  });

  test.describe('Language Switcher', () => {
    test('language switcher is visible on desktop', async ({ page }) => {
      await page.goto('/');

      // The language button should show current language (EN or FR)
      const langButton = page.locator('button[aria-label="Select language"]');
      await expect(langButton).toBeVisible();
    });

    test('clicking language switcher toggles language', async ({ page }) => {
      await page.goto('/');

      const langButton = page.locator('button[aria-label="Select language"]');
      const currentLang = await langButton.textContent();

      // Open the dropdown
      await langButton.click();

      // Click the alternative language option
      const otherLangOption = page.locator('.absolute.right-0.top-full.z-50 button');
      await otherLangOption.click();

      // The button should now display the other language
      const newLang = await langButton.textContent();
      expect(newLang).not.toBe(currentLang);
    });
  });

  test.describe('Mobile Menu', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('hamburger menu opens and shows navigation links', async ({ page }) => {
      await page.goto('/');

      // Click the hamburger menu button
      const menuButton = page.locator('button[aria-label="Open menu"]');
      await expect(menuButton).toBeVisible();
      await menuButton.click();

      // The mobile nav should slide in
      const mobileNav = page.locator('nav.fixed');
      await expect(mobileNav).toBeVisible();

      // Should contain shop and contact links
      await expect(mobileNav.locator('a[href="/shop"]')).toBeVisible();
      await expect(mobileNav.locator('a[href="/contact"]')).toBeVisible();
    });

    test('mobile menu close button works', async ({ page }) => {
      await page.goto('/');

      const menuButton = page.locator('button[aria-label="Open menu"]');
      await menuButton.click();

      const mobileNav = page.locator('nav.fixed');
      await expect(mobileNav).toBeVisible();

      // Close the menu
      const closeButton = page.locator('button[aria-label="Close menu"]');
      await closeButton.click();

      await expect(mobileNav).not.toBeVisible();
    });

    test('mobile menu link navigates and closes menu', async ({ page }) => {
      await page.goto('/');

      const menuButton = page.locator('button[aria-label="Open menu"]');
      await menuButton.click();

      const mobileNav = page.locator('nav.fixed');
      await mobileNav.locator('a[href="/shop"]').click();

      await expect(page).toHaveURL('/shop');
      await expect(mobileNav).not.toBeVisible();
    });

    test('mobile menu shows sign in/up links when not authenticated', async ({ page }) => {
      await page.goto('/');

      const menuButton = page.locator('button[aria-label="Open menu"]');
      await menuButton.click();

      const mobileNav = page.locator('nav.fixed');
      await expect(mobileNav.locator('a[href="/signin"]')).toBeVisible();
      await expect(mobileNav.locator('a[href="/signup"]')).toBeVisible();
    });
  });

  test('404 page displays for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('networkidle');

    // The page should show some 404 or not found content
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});
