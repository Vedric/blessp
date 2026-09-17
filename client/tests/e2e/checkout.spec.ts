import { test, expect, type Page } from '@playwright/test';

// Golden-path end-to-end: resolve a real product, add it to the guest cart,
// proceed to checkout, confirm the server-estimated shipping line, fill the
// guest shipping form, and reach the payment step where the Stripe
// PaymentElement mounts.
//
// The real card is never submitted here: the iframe sandbox makes automated
// entry brittle across Stripe SDK versions, and CI runs without a publishable
// key. The payment-step assertions are therefore gated on
// VITE_STRIPE_PUBLISHABLE_KEY, mirroring how the app disables payment when the
// key is unset. External card authorization requires a configured Stripe sandbox and is not claimed by this suite.

const GUEST_EMAIL = `e2e-${Date.now()}@example.com`;
const STRIPE_CONFIGURED = Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY);

async function addSeededProductToCart(page: Page): Promise<void> {
  // Resolve a stable fixture through the real catalogue API. Pagination and
  // products created by admin scenarios must not change which variant we buy.
  const response = await page.request.get('/api/v1/products?search=Classic%20Black%20Hoodie');
  expect(response.ok()).toBe(true);
  const catalogue = await response.json();
  const product = catalogue.data.find((item: { name: string }) => item.name === 'Classic Black Hoodie');
  expect(product).toBeTruthy();
  await page.goto(`/products/${product.id}`);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'M', exact: true }).click();

  const addToCart = page.getByRole('button', { name: /^add to cart$|^ajouter au panier$/i }).first();
  await expect(addToCart).toBeVisible({ timeout: 10_000 });
  await addToCart.click();

  // The guest cart writes to localStorage inside the add handler; wait for the
  // success toast so the write has settled before we navigate to checkout.
  await expect(page.getByText(/added to cart|ajouté au panier/i).first())
    .toBeVisible({ timeout: 5_000 });
}

async function fillGuestShipping(page: Page, email: string): Promise<void> {
  await page.locator('#guest-email').fill(email);

  for (const [key, value] of Object.entries({ firstName: 'Browser', lastName: 'Test', addressLine1: '123 Test Street', city: 'Montreal', province: 'QC', postalCode: 'H2X 1Y4' })) {
    await page.locator(`#shipping-${key}`).fill(value);
  }

}

test.describe('Checkout golden path', () => {
  test('guest adds a product, reaches checkout, and sees the shipping estimate', async ({ page }) => {
    await addSeededProductToCart(page);

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // The order summary with a shipping line is the shipping-step contract we
    // want CI to catch when it regresses. Shipping is server-estimated (flat
    // rate below the free-shipping threshold, free above it), so we assert the
    // line renders a value rather than a specific amount.
    const summary = page
      .locator('div.border')
      .filter({ has: page.getByRole('heading', { name: /order summary|récapitulatif/i }) })
      .first();
    await expect(summary).toBeVisible({ timeout: 10_000 });

    const shippingRow = summary
      .locator('div.flex.justify-between')
      .filter({ hasText: /shipping|livraison/i })
      .first();
    await expect(shippingRow).toBeVisible();
    await expect(shippingRow).toContainText(/free|gratuit|\$|\d/i);

    await fillGuestShipping(page, GUEST_EMAIL);

    const submit = page.getByRole('button', { name: /continue to payment|passer au paiement/i });

    // Submitting creates the order and prepares the PaymentElement. Without a
    // Stripe publishable key (CI) the iframe cannot render, so the payment-step
    // assertions run only when the key is present.
    if (!STRIPE_CONFIGURED) {
      await expect(submit).toBeDisabled();
      await expect(page.getByRole('status')).toContainText(/payment is temporarily unavailable/i);
      test.info().annotations.push({
        type: 'note',
        description: 'VITE_STRIPE_PUBLISHABLE_KEY unset; payment step not exercised.',
      });
      return;
    }

    await expect(submit).toBeEnabled();
    await submit.click();

    const paymentHeading = page
      .getByRole('heading', { name: /^payment$|^paiement$/i })
      .first();
    await expect(paymentHeading).toBeVisible({ timeout: 20_000 });

    // The PaymentElement mounts as a Stripe-hosted iframe once the client
    // secret is available.
    const stripeFrame = page.locator(
      'iframe[name^="__privateStripeFrame"], iframe[title*="payment" i], iframe[src*="js.stripe.com"]',
    );
    await expect(stripeFrame.first()).toBeVisible({ timeout: 20_000 });
  });

  test('guest reaches /checkout without being redirected to sign in', async ({ page }) => {
    await addSeededProductToCart(page);

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    // Checkout is public: a guest with a cart stays on the page instead of
    // being bounced to the sign-in screen.
    await expect(page).not.toHaveURL(/\/signin/);
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.locator('#guest-email')).toBeVisible({ timeout: 10_000 });
  });
});
