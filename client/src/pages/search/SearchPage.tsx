import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, PackageOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Pagination } from '@/components/common/Pagination';
import { ProductCard } from '@/components/common/ProductCard';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import type { Product, PaginatedResponse } from '@/lib/types';

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const query = searchParams.get('q') || '';
  const pageParam = Number(searchParams.get('page') || '1');
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [inputValue, setInputValue] = useState(query);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    requestController.current = controller;
    clearTimeout(debounceRef.current);
    setInputValue(query);
    setProducts([]); setTotalItems(0); setError(false);
    setHasSearched(Boolean(query.trim()));
    setIsLoading(Boolean(query.trim()));
    if (query.trim()) {
      api.getRaw<PaginatedResponse<Product>>(`/products?search=${encodeURIComponent(query.trim())}&perPage=24&page=${currentPage}`, { signal: controller.signal })
        .then(res => { if (generation.current === current) { setProducts(res.data); setTotalItems(res.pagination.totalItems); setTotalPages(res.pagination.totalPages); } })
        .catch(() => { if (generation.current === current) setError(true); })
        .finally(() => { if (generation.current === current) setIsLoading(false); });
    }
    return () => { controller.abort(); generation.current += 1; clearTimeout(debounceRef.current); };
  }, [query, currentPage, attempt]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleInputChange = (value: string) => {
    requestController.current?.abort();
    setInputValue(value);
    generation.current += 1;
    setProducts([]); setTotalItems(0); setError(false);
    setHasSearched(Boolean(value.trim())); setIsLoading(Boolean(value.trim()));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set('q', value.trim());
      setSearchParams(params, { replace: true });
      setAttempt(previous => previous + 1);
    }, 300);
  };

  return (
    <div className="min-h-screen">
      {/* Search header */}
      <div className="bg-[#f3f1eb] pt-12 pb-10">
        <h1 className="sr-only">{t('search.title')}</h1>
        <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
          <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('search.title') }]} />
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              aria-label={t('search.placeholder')}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full border border-neutral-200 bg-white py-4 pl-12 pr-4 text-lg text-neutral-900 placeholder:text-neutral-500 transition-colors duration-200 focus:border-[#a07a52] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a07a52]/20"
            />
          </div>
          {hasSearched && !isLoading && (
            <p className="mt-4 text-sm text-neutral-600">
              {t('search.resultsCount', { count: totalItems, query })}
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-neutral-100" />
                <div className="mt-3 h-4 w-3/4 bg-neutral-100" />
                <div className="mt-2 h-4 w-1/4 bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="py-12 text-center">
            <p>{t('search.failed')}</p>
            <button className="mt-4 border px-6 py-3" onClick={() => setAttempt(previous => previous + 1)}>{t('common.retry', { defaultValue: 'Try again' })}</button>
          </div>
        ) : !hasSearched ? (
          <motion.div
            className="flex flex-col items-center py-24 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-50">
              <Search className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
            </div>
            <h3 className="mt-6 font-display text-lg font-medium text-neutral-900">
              {t('search.searchCollection')}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              {t('search.searchDesc')}
            </p>
          </motion.div>
        ) : products.length === 0 ? (
          <motion.div
            className="flex flex-col items-center py-24 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-50">
              <PackageOpen className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
            </div>
            <h3 className="mt-6 font-display text-lg font-medium text-neutral-900">
              {t('search.noResults', { query })}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              {t('search.noResultsDesc')}
            </p>
            <Link
              to="/shop"
              className="mt-6 bg-neutral-900 px-8 py-3 text-sm font-medium tracking-widest text-white uppercase transition-all duration-300 hover:bg-[#a07a52] hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a07a52] focus-visible:ring-offset-2"
            >
              {t('search.browseCollection')}
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
              {products.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
            <Pagination label={t('shop.pagination')} page={currentPage} totalPages={totalPages} onChange={page => {
              const params = new URLSearchParams(searchParams); params.set('page', String(page)); setSearchParams(params);
            }} />
          </>
        )}
      </div>
    </div>
  );
}
