import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import type { Product, PaginatedResponse } from '@/lib/types';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const generation = useRef(0);
  useDialogFocus(isOpen, panel, onClose);

  useEffect(() => {
    generation.current += 1;
    clearTimeout(debounceRef.current);
    setQuery(''); setResults([]); setIsSearching(false);
    return () => { generation.current += 1; clearTimeout(debounceRef.current); };
  }, [isOpen]);

  const searchProducts = useCallback(async (q: string, requestGeneration: number) => {
    try {
      const res = await api.getRaw<PaginatedResponse<Product>>(
        `/products?search=${encodeURIComponent(q.trim())}&perPage=5`,
      );
      if (requestGeneration === generation.current) setResults(res.data);
    } catch {
      if (requestGeneration === generation.current) setResults([]);
    } finally {
      if (requestGeneration === generation.current) setIsSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value); setResults([]);
    const current = ++generation.current;
    clearTimeout(debounceRef.current);
    setIsSearching(Boolean(value.trim()));
    if (value.trim()) debounceRef.current = setTimeout(() => searchProducts(value, current), 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onClose();
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleResultClick = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel} role="dialog" aria-modal="true" aria-label={t('searchOverlay.title')} tabIndex={-1}
            className="fixed inset-x-0 top-0 z-50 bg-white shadow-2xl"
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-medium tracking-[0.2em] text-neutral-500 uppercase">
                  {t('searchOverlay.title')}
                </span>
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
                  aria-label="Close search"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <label htmlFor={searchId} className="sr-only">{t('searchOverlay.placeholder')}</label>
                <div className="relative">
                  <Search className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                  <input
                    ref={inputRef} id={searchId} data-dialog-initial-focus
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={t('searchOverlay.placeholder')}
                    className="w-full border-b-2 border-neutral-200 bg-transparent py-4 pl-8 pr-4 text-xl text-neutral-900 placeholder:text-neutral-500 focus:border-[#a07a52] focus:outline-none"
                  />
                </div>
              </form>

              {/* Quick results */}
              {query.trim() && (
                <div className="mt-6 max-h-[50vh] overflow-y-auto">
                  {isSearching ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex animate-pulse gap-4">
                          <div className="h-16 w-16 bg-neutral-100" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 w-3/4 bg-neutral-100" />
                            <div className="h-4 w-1/4 bg-neutral-100" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : results.length > 0 ? (
                    <>
                      <div className="space-y-1">
                        {results.map((product) => (
                          <Link
                            key={product.id}
                            to={`/products/${product.id}`}
                            onClick={handleResultClick}
                            className="flex items-center gap-4 rounded px-2 py-3 transition-colors hover:bg-neutral-50"
                          >
                            <div className="h-16 w-16 flex-shrink-0 overflow-hidden bg-neutral-100">
                              <img
                                src={product.picture || product.images?.[0]}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-900">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-sm text-neutral-500">
                                {formatPrice(product.price)}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                      <Link
                        to={`/search?q=${encodeURIComponent(query.trim())}`}
                        onClick={handleResultClick}
                        className="mt-4 block py-3 text-center text-sm font-medium tracking-widest text-[#80603c] uppercase transition-colors hover:text-[#80603c]"
                      >
                        {t('searchOverlay.viewAllResults')}
                      </Link>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-neutral-500">
                      {t('searchOverlay.noResults', { query })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
