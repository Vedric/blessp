import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useCurrency, type CurrencyCode } from '@/context/CurrencyContext';

interface CurrencyOption {
  code: CurrencyCode;
  flag: string;
  symbol: string;
}

const currencies: CurrencyOption[] = [
  { code: 'CAD', flag: '\ud83c\udde8\ud83c\udde6', symbol: '$' },
  { code: 'USD', flag: '\ud83c\uddfa\ud83c\uddf8', symbol: '$' },
  { code: 'EUR', flag: '\ud83c\uddea\ud83c\uddfa', symbol: '\u20ac' },
  { code: 'GBP', flag: '\ud83c\uddec\ud83c\udde7', symbol: '\u00a3' },
  { code: 'CHF', flag: '\ud83c\udde8\ud83c\udded', symbol: 'CHF' },
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
        className="flex items-center gap-1.5 rounded border border-neutral-700 px-2.5 py-1.5 text-xs font-medium tracking-wider text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-300"
        aria-label="Select currency"
      >
        <span>{current.flag}</span>
        <span>{current.code}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute bottom-full left-0 z-50 mb-2 w-40 overflow-hidden border border-neutral-700 bg-neutral-900 shadow-xl"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            {currencies.map((opt) => (
              <button
                key={opt.code}
                onClick={() => {
                  setCurrency(opt.code);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                  currency === opt.code
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                <span>{opt.flag}</span>
                <span className="font-medium">{opt.code}</span>
                <span className="ml-auto text-xs text-neutral-500">{opt.symbol}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
