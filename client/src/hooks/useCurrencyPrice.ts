import { useCurrency } from '@/context/CurrencyContext';

export function useCurrencyPrice() {
  const { formatPrice } = useCurrency();
  return formatPrice;
}
