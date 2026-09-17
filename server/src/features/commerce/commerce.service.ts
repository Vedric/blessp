import { Env } from '../../core/config/env';
import { demoShippingRates, type ShippingRate } from '../../core/config/commerce.schema';
import { ValidationError } from '../../core/errors/http.errors';

export function shippingRates(): ShippingRate[] { return Env.SHIPPING_RATES_JSON ?? demoShippingRates; }
export function quoteShipping(country: string, discountedSubtotalCents: number): number {
  const rate = shippingRates().find(item => item.country === country);
  if (!rate) throw new ValidationError('This delivery destination is not available.');
  if (!Number.isSafeInteger(discountedSubtotalCents) || discountedSubtotalCents < 0) throw new ValidationError('Invalid order subtotal.');
  return rate.freeThresholdCents !== null && discountedSubtotalCents >= rate.freeThresholdCents ? 0 : rate.feeCents;
}
