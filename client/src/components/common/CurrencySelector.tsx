import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useCurrency, type CurrencyCode } from '@/context/CurrencyContext';

interface CurrencyOption {
  code: CurrencyCode;
  symbol: string;
}

const currencies: CurrencyOption[] = [
  { code: 'CAD', symbol: '$' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
];

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = currencies.find((c) => c.code === currency) ?? currencies[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-5 items-center gap-1 text-[13px] font-medium tracking-wider text-neutral-600 transition-colors hover:text-neutral-900"
        aria-label="Select currency"
      >
        <span>{current.code}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-2 w-28 overflow-hidden border border-neutral-100 bg-white shadow-lg"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            {currencies.map((opt) => (
              <button
                key={opt.code}
                onClick={() => {
                  setCurrency(opt.code);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs font-medium tracking-wider transition-colors ${
                  currency === opt.code
                    ? 'bg-neutral-50 text-neutral-900'
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <span>{opt.code}</span>
                <span className="text-neutral-400">{opt.symbol}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
