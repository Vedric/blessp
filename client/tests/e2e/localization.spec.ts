import { test, expect, type Page } from '@playwright/test';

async function changeLanguage(page: Page, current: 'fr' | 'en', width: number) {
  const mobile = width < 768;
  if (mobile) await page.getByRole('button', { name: current === 'fr' ? 'Ouvrir le menu' : 'Open menu', exact: true }).click();
  const scope = mobile ? page.getByRole('dialog', { name: 'Menu', exact: true }) : page.getByRole('banner');
  await scope.getByRole('button', { name: current === 'fr' ? 'Choisir la langue' : 'Select language', exact: true }).click();
  await scope.getByRole('button', { name: current === 'fr' ? 'EN' : 'FR', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', current === 'fr' ? 'en' : 'fr');
  if (mobile) {
    await scope.getByRole('button', { name: current === 'fr' ? 'Close menu' : 'Fermer le menu', exact: true }).click();
    await expect(scope).toHaveCount(0);
  }
}

for (const width of [320, 1440]) test(`storefront controls follow language changes without losing cart or form state at ${width}px`, async ({ page }, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => localStorage.setItem('blessp_cookie_consent', 'rejected'));
  await page.goto('/shop?lng=fr');
  await expect(page.getByRole('banner').getByRole('button', { name: 'Compte', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Fil d’Ariane', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Rechercher', exact: true });
  await expect(search.getByRole('button', { name: 'Fermer la recherche', exact: true })).toBeVisible();
  await search.getByRole('textbox').fill('Ocean Blue Hoodie');
  await search.getByRole('link', { name: /Ocean Blue Hoodie/ }).click();
  await expect(search).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Partager sur Facebook', exact: true })).toHaveAttribute('title', 'Partager sur Facebook');
  await expect(page.getByRole('button', { name: 'Copier le lien', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 étoile', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '2 étoiles', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guide des tailles', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer le guide des tailles', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter au panier', exact: true }).first().click();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Panier', exact: true }).click();
  const cart = page.getByRole('dialog');
  await cart.getByRole('button', { name: 'Augmenter la quantité', exact: true }).click();
  await expect(cart).toContainText('179.98');
  await cart.getByRole('button', { name: 'Fermer le panier', exact: true }).click();
  await expect(cart).toHaveCount(0);
  await changeLanguage(page, 'fr', width);
  await expect(page.getByRole('button', { name: 'Share on Facebook', exact: true })).toHaveAttribute('title', 'Share on Facebook');
  await expect(page.getByRole('button', { name: '1 star', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cart', exact: true }).click();
  await expect(cart).toContainText('179.98');
  await cart.getByRole('button', { name: 'Decrease quantity', exact: true }).click();
  await expect(cart).toContainText('89.99');
  await cart.getByRole('button', { name: 'Close cart', exact: true }).click();
  await expect(cart).toHaveCount(0);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const password = page.locator('#password');
  await password.fill('LocalizedPassword123!');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await changeLanguage(page, 'en', width);
  await expect(password).toHaveValue('LocalizedPassword123!');
  await page.getByRole('button', { name: 'Masquer le mot de passe', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: 'Afficher le mot de passe', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath(`localized-signin-${width}.png`) });
});
