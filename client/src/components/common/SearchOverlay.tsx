import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import type { Product, PaginatedResponse } from '@/lib/types';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.getRaw<PaginatedResponse<Product>>(
        `/products?search=${encodeURIComponent(q.trim())}&perPage=5`,
      );
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProducts(value), 300);
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
            className="fixed inset-x-0 top-0 z-50 bg-white shadow-2xl"
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-medium tracking-[0.2em] text-neutral-400 uppercase">
                  Search
                </span>
                <button
                  onClick={onClose}
                  className="text-neutral-400 transition-colors hover:text-neutral-900"
                  aria-label="Close search"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="relative">
                  <Search className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="What are you looking for?"
                    className="w-full border-b-2 border-neutral-200 bg-transparent py-4 pl-8 pr-4 text-xl text-neutral-900 placeholder:text-neutral-300 focus:border-[#c8a97e] focus:outline-none"
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
                        className="mt-4 block py-3 text-center text-sm font-medium tracking-widest text-[#c8a97e] uppercase transition-colors hover:text-[#b89a6f]"
                      >
                        View all results
                      </Link>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-neutral-500">
                      No results for &ldquo;{query}&rdquo;
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
