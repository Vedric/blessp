import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { orderConfirmationPayload } = require('../../../server/dist/features/orders/order.emails');
for (const locale of ['fr', 'en'] as const) {
  test(`order email preview remains readable and accessible at 320 px (${locale})`, async ({ page }, testInfo) => {
    const payload = orderConfirmationPayload({ locale, orderId: 'local-email-fixture', orderNumber: 'BLP-20260917-ABCDEF123456', customerEmail: 'preview@example.invalid', customerName: 'Marie <script>inert</script>', items: [{ name: 'Premium Hoodie with an unusually long product description', size: 'XXL', color: 'Black', quantity: 2, unitPriceCents: 5000 }], subtotalCents: 10000, discountCents: 1000, couponCode: 'WELCOME', totalCents: 9995, shippingCents: 995, shippingAddress: { city: 'Ottawa', province: 'ON', country: 'CA' } });
    await page.setViewportSize({ width: 320, height: 740 }); await page.setContent(payload.html);
    expect(await page.locator('script').count()).toBe(0); await expect(page.locator('body')).toContainText('<script>inert</script>');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const price = page.locator('th').last().locator('..').locator('..').locator('tr').nth(1).locator('td').last();
    expect(await price.evaluate(cell => { const range = document.createRange(); range.selectNodeContents(cell); return [...range.getClientRects()].filter(rect => rect.width > 1 && rect.height > 1).length; })).toBe(1);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`order-email-mobile-${locale}.png`), fullPage: true });
  });
}
