import { Env } from '../../src/core/config/env';
import { ShippingRatesJsonSchema } from '../../src/core/config/commerce.schema';
import { quoteShipping } from '../../src/features/commerce/commerce.service';
import { orderConfirmationPayload } from '../../src/features/orders/order.emails';
const original = Env.SHIPPING_RATES_JSON;
afterEach(() => { Env.SHIPPING_RATES_JSON = original; });
it('quotes each destination using post-discount subtotals and nullable free thresholds', () => {
  Env.SHIPPING_RATES_JSON = [{ country: 'CA', feeCents: 750, freeThresholdCents: 10000 }, { country: 'FR', feeCents: 2400, freeThresholdCents: null }];
  expect(quoteShipping('CA', 9999)).toBe(750); expect(quoteShipping('CA', 10000)).toBe(0);
  expect(quoteShipping('FR', 100000)).toBe(2400);
  expect(() => quoteShipping('US', 10000)).toThrow('destination');
  expect(() => quoteShipping('CA', -1)).toThrow('subtotal');
});
it.each(['invalid-json', '[]', '[{"country":"CA","feeCents":-1,"freeThresholdCents":null}]', '[{"country":"ca","feeCents":0,"freeThresholdCents":null}]', '[{"country":"CA","feeCents":1.5,"freeThresholdCents":null}]', '[{"country":"CA","feeCents":0,"freeThresholdCents":null,"tax":15}]', '[{"country":"CA","feeCents":0,"freeThresholdCents":null},{"country":"CA","feeCents":20,"freeThresholdCents":null}]'])('rejects invalid shipping configuration: %s', value => {
  expect(ShippingRatesJsonSchema.safeParse(value).success).toBe(false);
});
it('permits explicit free shipping and no free threshold', () => {
  expect(ShippingRatesJsonSchema.parse('[{"country":"CA","feeCents":0,"freeThresholdCents":null}]')).toEqual([{ country: 'CA', feeCents: 0, freeThresholdCents: null }]);
});
it.each(['en', 'fr'] as const)('renders the order confirmation in %s with CAD and escaped customer data', locale => {
  const payload = orderConfirmationPayload({ locale, orderId: 'order-id', orderNumber: 'ORDER123', customerEmail: 'customer@example.com', customerName: '<img src=x>', items: [{ name: '<script>name</script>', quantity: 2, unitPriceCents: 1500 }], subtotalCents: 3000, discountCents: 100, shippingCents: 995, totalCents: 3895, couponCode: '<coupon>', shippingAddress: { city: '<City>', country: 'CA' } });
  expect(payload.html).toContain(`<html lang="${locale}">`); expect(payload.html).toContain('CAD');
  expect(payload.subject).toContain(locale === 'fr' ? 'Confirmation de commande' : 'Order Confirmation');
  expect(payload.html).toContain(locale === 'fr' ? 'Sous-total' : 'Subtotal');
  expect(payload.html).toContain('&lt;img src=x&gt;'); expect(payload.html).not.toContain('<script>');
  expect(payload.html).not.toContain('You will receive a shipping confirmation');
});
