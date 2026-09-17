import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import crypto from 'node:crypto';

// Real browser + app + database, simulated SDK/provider boundaries. This does
// not certify a Google/Apple/PayPal account, wallet device or external charge.
async function sdk(page: Page, mode = 'named') {
  const subject = crypto.randomUUID();
  const token = `fixture:${subject}:${mode === 'profile' ? 'profile' : 'named'}`;
  await page.route('https://accounts.google.com/gsi/client', route => mode === 'offline' ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: `window.google = {accounts:{oauth2:{initTokenClient: function(o) {return {requestAccessToken: function() {${mode === 'cancel' ? "o.error_callback({type:'popup_closed'})" : mode === 'blocked' ? "o.error_callback({type:'popup_failed_to_open'})" : `o.callback({access_token:${JSON.stringify(token)}})`}}}}}}};` }));
  const appleResponse = { authorization: { id_token: token }, ...(mode === 'profile' ? {} : { user: { name: { firstName: 'Apple', lastName: 'Browser' } } }) };
  const appleScript = `window.AppleID = { auth: { init: function(o) { window.__appleOptions = o; }, signIn: async function() { ${mode === 'cancel' ? "throw {error:'popup_closed_by_user'};" : `return ${JSON.stringify(appleResponse)};`} } } };`;
  await page.route('https://appleid.cdn-apple.com/**', route => mode === 'offline' ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: appleScript }));
  return subject;
}
test.beforeEach(async ({ page }) => {
  test.info().annotations.push({ type: 'provider-boundary', description: 'SDKs and provider responses are synthetic; app routes, persistence and browser navigation are real.' });
  await page.addInitScript(() => { localStorage.setItem('preferred_language', 'en'); localStorage.setItem('blessp_cookie_consent', 'rejected'); localStorage.setItem('blessp_mfa_reminded_at', String(Date.now())); });
});
for (const provider of ['Google', 'Apple']) {
  test(`${provider}: creates account and preserves protected destination`, async ({ page }) => {
    await sdk(page); await page.goto('/profile/orders'); await expect(page).toHaveURL(/signin/);
    await page.getByRole('button', { name: `Continue with ${provider}`, exact: true }).click();
    await expect(page).toHaveURL(/\/profile\/orders$/);
    await expect(page.getByRole('heading', { name: 'My Orders', exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole('heading', { name: 'My Orders', exact: true })).toBeVisible();
  });
  test(`${provider}: missing names can be completed on a mobile screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); await sdk(page, 'profile'); await page.goto('/signin');
    await page.getByRole('button', { name: `Continue with ${provider}`, exact: true }).click();
    await expect(page.getByText('Complete your name to create your account.')).toBeVisible();
    await page.getByLabel('First Name', { exact: true }).fill('Mobile'); await page.getByLabel('Last Name', { exact: true }).fill('Tester');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(page).toHaveURL(/\/$/);
  });
  test(`${provider}: popup cancellation releases the button without an error`, async ({ page }) => {
    await sdk(page, 'cancel'); await page.goto('/signin'); const button = page.getByRole('button', { name: `Continue with ${provider}`, exact: true });
    await button.click(); await expect(button).toBeEnabled(); await expect(page).toHaveURL(/signin/); await expect(page.getByRole('alert')).toHaveCount(0);
  });
  test(`${provider}: profile completion can be cancelled and retried`, async ({ page }) => {
    await sdk(page, 'profile'); await page.goto('/signin'); const button = page.getByRole('button', { name: `Continue with ${provider}`, exact: true });
    await button.click(); await page.getByLabel('First Name', { exact: true }).fill('Cancelled'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(button).toBeEnabled(); await button.click(); await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('');
  });
}
test('SDK failures leave password login usable and allow retry', async ({ page }) => {
  await sdk(page, 'offline'); await page.goto('/signin'); await expect(page.getByRole('alert')).toContainText('Social sign-in is unavailable');
  await expect(page.locator('#email')).toBeEnabled(); await expect(page.locator('#password')).toBeEnabled();
  await page.unroute('https://accounts.google.com/gsi/client'); await page.unroute('https://appleid.cdn-apple.com/**'); await sdk(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Continue with Apple', exact: true })).toBeEnabled();
});
test('blocked Google popup shows an actionable error and allows another attempt', async ({ page }) => {
  await sdk(page, 'blocked'); await page.goto('/signin'); const button = page.getByRole('button', { name: 'Continue with Google', exact: true });
  await button.click(); await expect(button).toBeEnabled(); await expect(page.getByText(/Google sign-in failed/i)).toBeVisible();
});

async function checkout(page: Page) {
  await sdk(page);
  const response = await page.request.get('/api/v1/products?search=Classic%20Black%20Hoodie');
  const product = (await response.json()).data.find((p: { name: string }) => p.name === 'Classic Black Hoodie');
  await page.goto(`/products/${product.id}`); await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click(); await expect(page.getByText(/added to cart/i).first()).toBeVisible();
  await page.goto('/checkout'); await page.locator('#guest-email').fill(`paypal-browser-${crypto.randomUUID()}@example.com`);
  for (const [key, value] of Object.entries({ firstName: 'PayPal', lastName: 'Browser', addressLine1: '1 Test St', city: 'Ottawa', province: 'ON', postalCode: 'K1A 0B1' })) await page.locator(`#shipping-${key}`).fill(value);
  await page.getByRole('radio', { name: 'PayPal', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to Payment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with PayPal', exact: true })).toBeVisible();
}
test('PayPal guest checkout approves, captures, confirms and restores the real order', async ({ page }) => {
  await checkout(page);
  await page.route('https://www.sandbox.paypal.com/**', async route => {
    const remoteId = new URL(route.request().url()).searchParams.get('token');
    const approved = await page.request.post(`/__e2e/paypal/approve/${remoteId}`); expect(approved.status()).toBe(204);
    await route.fulfill({ contentType: 'text/html', body: '<a href="http://127.0.0.1:3107/checkout?paypal=return">Return to the shop</a>' });
  });
  await page.getByRole('button', { name: 'Continue with PayPal', exact: true }).click(); await page.getByRole('link', { name: 'Return to the shop' }).click();
  await expect(page.getByText(/order confirmed/i).first()).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('blessp_checkout_pending'))).toBeNull();
});
test('PayPal cancellation on mobile preserves the order and permits releasing its reservation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await checkout(page);
  await page.goto('/checkout?paypal=cancel'); await expect(page.getByRole('alert')).toContainText('PayPal was closed');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#shipping-firstName')).toBeVisible(); expect(await page.evaluate(() => sessionStorage.getItem('blessp_checkout_pending'))).toBeNull();
});
test('a forged PayPal return does not mark an unapproved order paid', async ({ page }) => {
  await checkout(page); await page.goto('/checkout?paypal=return&token=forged&PayerID=forged');
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByText(/order confirmed/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check my payment', exact: true })).toBeEnabled();
});
