import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';

export type CurrencyCode = 'CAD' | 'USD' | 'EUR' | 'GBP' | 'CHF';

export interface ExchangeRates {
  base: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  updatedAt: string;
}

interface CurrencyConfig {
  locale: string;
  currency: CurrencyCode;
  symbol: string;
}

const CURRENCY_CONFIG: Record<CurrencyCode, CurrencyConfig> = {
  CAD: { locale: 'en-CA', currency: 'CAD', symbol: '$' },
  USD: { locale: 'en-US', currency: 'USD', symbol: '$' },
  EUR: { locale: 'fr-FR', currency: 'EUR', symbol: '\u20ac' },
  GBP: { locale: 'en-GB', currency: 'GBP', symbol: '\u00a3' },
  CHF: { locale: 'de-CH', currency: 'CHF', symbol: 'CHF' },
};

const STORAGE_KEY = 'preferred_currency';

interface CurrencyState {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatPrice: (cents: number) => string;
  rates: ExchangeRates | null;
}

const CurrencyContext = createContext<CurrencyState | undefined>(undefined);

function getStoredCurrency(): CurrencyCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in CURRENCY_CONFIG) {
      return stored as CurrencyCode;
    }
  } catch {
    // localStorage may be unavailable in some environments
  }
  return 'CAD';
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(getStoredCurrency);
  const [rates, setRates] = useState<ExchangeRates | null>(null);

  useEffect(() => {
    api
      .get<ExchangeRates>('/currencies/rates')
      .then((data) => setRates(data))
      .catch(() => {
        // Fall back to default rates when the API is unreachable
        setRates({
          base: 'CAD',
          rates: { CAD: 1.0, USD: 0.74, EUR: 0.68, GBP: 0.58, CHF: 0.65 },
          updatedAt: new Date().toISOString(),
        });
      });
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  const formatPrice = useCallback(
    (cents: number): string => {
      const config = CURRENCY_CONFIG[currency];

      // Convert from CAD (base) to the selected currency
      let convertedCents = cents;
      if (currency !== 'CAD' && rates) {
        const rate = rates.rates[currency];
        if (rate) {
          convertedCents = Math.round(cents * rate);
        }
      }

      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency,
      }).format(convertedCents / 100);
    },
    [currency, rates],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, rates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyState {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
