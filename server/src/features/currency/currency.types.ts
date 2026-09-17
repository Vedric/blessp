export type CurrencyCode = 'CAD' | 'USD' | 'EUR' | 'GBP' | 'CHF';

export interface ExchangeRates {
  base: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  updatedAt: string;
}
