import { CurrencyService } from '@features/currency/currency.service';

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    service = new CurrencyService();
  });

  describe('getRates', () => {
    it('returns rates with CAD as base', () => {
      const result = service.getRates();

      expect(result.base).toBe('CAD');
      expect(result.rates.CAD).toBe(1.0);
      expect(result.updatedAt).toBeDefined();
    });

    it('includes all supported currencies', () => {
      const result = service.getRates();
      const currencies = Object.keys(result.rates);

      expect(currencies).toContain('CAD');
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
      expect(currencies).toContain('CHF');
      expect(currencies).toHaveLength(5);
    });
  });

  describe('convert', () => {
    it('returns same amount for same currency', () => {
      const result = service.convert(10000, 'CAD', 'CAD');

      expect(result).toBe(10000);
    });

    it('converts CAD to USD correctly', () => {
      // CAD rate is 1.0, USD rate is 0.74
      // 10000 CAD = 10000 / 1.0 * 0.74 = 7400 USD cents
      const result = service.convert(10000, 'CAD', 'USD');

      expect(result).toBe(7400);
    });

    it('converts USD to EUR correctly (via CAD base)', () => {
      // USD rate is 0.74, EUR rate is 0.68
      // 7400 USD cents -> 7400 / 0.74 = 10000 CAD cents -> 10000 * 0.68 = 6800 EUR cents
      const result = service.convert(7400, 'USD', 'EUR');

      expect(result).toBe(6800);
    });

    it('rounds to nearest cent', () => {
      // 1000 GBP cents -> 1000 / 0.58 = 1724.1379... CAD -> * 0.74 = 1275.86... -> 1276
      const result = service.convert(1000, 'GBP', 'USD');

      expect(result).toBe(Math.round((1000 / 0.58) * 0.74));
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
