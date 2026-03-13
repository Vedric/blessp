import type { CurrencyCode, ExchangeRates } from './currency.types';

/**
 * Static exchange rates with CAD as the base currency.
 * In a production environment these would be fetched from an external
 * provider (e.g. Open Exchange Rates) and cached with a short TTL.
 */
const RATES: Record<CurrencyCode, number> = {
  CAD: 1.0,
  USD: 0.74,
  EUR: 0.68,
  GBP: 0.58,
  CHF: 0.65,
};

const RATES_UPDATED_AT = '2026-03-01T00:00:00Z';

export class CurrencyService {
  getRates(): ExchangeRates {
    return {
      base: 'CAD',
      rates: { ...RATES },
      updatedAt: RATES_UPDATED_AT,
    };
  }

  /**
   * Convert an amount in cents from one currency to another.
   * Returns the result in cents (rounded to the nearest integer).
   */
  convert(amountCents: number, from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return amountCents;

    // Convert to CAD first, then to the target currency
    const amountInBase = amountCents / RATES[from];
    const converted = amountInBase * RATES[to];

    return Math.round(converted);
  }
}
