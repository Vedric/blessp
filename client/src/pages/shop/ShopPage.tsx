import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, PackageOpen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';
import type { Product, PaginatedResponse } from '@/lib/types';
import { ProductCard } from '@/components/common/ProductCard';
import { Pagination } from '@/components/common/Pagination';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { RecentlyViewed } from '@/components/common/RecentlyViewed';
import { FilterPanel, type ActiveFilters, type FiltersData } from '@/components/shop/FilterPanel';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

const categories = ['All', 'Hoodies', 'Pants', 'Sets'];
const categoryTranslationKeys: Record<string, string> = {
  All: 'shop.categories.all',
  Hoodies: 'shop.categories.hoodies',
  Pants: 'shop.categories.pants',
  Sets: 'shop.categories.sets',
};
const sortOptions = [
  { labelKey: 'shop.sort.newest', value: 'createdAt:desc' },
  { labelKey: 'shop.sort.priceLowHigh', value: 'price:asc' },
  { labelKey: 'shop.sort.priceHighLow', value: 'price:desc' },
];

export default function ShopPage() {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersData, setFiltersData] = useState<FiltersData | null>(null);
  const [attempt, setAttempt] = useState(0);

  const currentCategory = categories.find(category => category.toLowerCase() === searchParams.get('category')?.toLowerCase()) || searchParams.get('category') || 'All';
  const currentSort = searchParams.get('sort') || 'createdAt:desc';
  const pageParam = Number(searchParams.get('page') || '1');
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  useDocumentMeta({
    title: t('shop.metaTitle', { defaultValue: 'Shop' }),
    description: t('shop.metaDescription', {
      defaultValue: 'Browse the full BLE$$ P collection: hoodies, tracksuits, pants and limited editions.',
    }),
  });

  // The URL is the single source of truth, including browser Back/Forward.
  const advancedFilters = useMemo<ActiveFilters>(() => {
    const price = (key: string) => {
      const raw = searchParams.get(key);
      const value = raw === null || raw === '' ? undefined : Number(raw);
      return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
    };
    return {
      minPrice: price('minPrice'), maxPrice: price('maxPrice'),
      colors: searchParams.get('colors')?.split(',').filter(Boolean) || [],
      sizes: searchParams.get('sizes')?.split(',').filter(Boolean) || [],
    };
  }, [searchParams]);

  const params = new URLSearchParams({ page: String(currentPage), perPage: '12', sort: currentSort });
  if (currentCategory !== 'All') params.set('category', currentCategory.toLowerCase());
  if (advancedFilters.minPrice !== undefined) params.set('minPrice', String(advancedFilters.minPrice));
  if (advancedFilters.maxPrice !== undefined) params.set('maxPrice', String(advancedFilters.maxPrice));
  if (advancedFilters.colors.length) params.set('colors', advancedFilters.colors.join(','));
  if (advancedFilters.sizes.length) params.set('sizes', advancedFilters.sizes.join(','));
  const query = params.toString();
  const priceKey = `${advancedFilters.minPrice}:${advancedFilters.maxPrice}`;
  const previousPriceKey = useRef(priceKey);

  useEffect(() => {
    const controller = new AbortController();
    api.get<FiltersData>('/products/filters', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setFiltersData(data); })
      .catch(() => { /* Filters are a progressive enhancement. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const delay = previousPriceKey.current === priceKey ? 0 : 300;
    previousPriceKey.current = priceKey;
    setIsLoading(true);
    setLoadError('');
    const timer = setTimeout(async () => {
      try {
        const res = await api.getRaw<PaginatedResponse<Product>>(`/products?${query}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setProducts(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.totalItems);
      } catch {
        if (!controller.signal.aborted) setLoadError('common.loadError');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, priceKey, attempt]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  const handleFiltersChange = (filters: ActiveFilters, options?: { replace?: boolean }) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');

    // Sync filter state to URL
    if (filters.minPrice !== undefined) {
      params.set('minPrice', String(filters.minPrice));
    } else {
      params.delete('minPrice');
    }
    if (filters.maxPrice !== undefined) {
      params.set('maxPrice', String(filters.maxPrice));
    } else {
      params.delete('maxPrice');
    }
    if (filters.colors.length > 0) {
      params.set('colors', filters.colors.join(','));
    } else {
      params.delete('colors');
    }
    if (filters.sizes.length > 0) {
      params.set('sizes', filters.sizes.join(','));
    } else {
      params.delete('sizes');
    }
    setSearchParams(params, options);
  };

  const activeFilterTags: { label: string; onRemove: () => void }[] = [];
  if (advancedFilters.minPrice !== undefined || advancedFilters.maxPrice !== undefined) {
    const min = advancedFilters.minPrice !== undefined ? formatPrice(advancedFilters.minPrice) : '$0';
    const max = advancedFilters.maxPrice !== undefined ? formatPrice(advancedFilters.maxPrice) : '...';
    activeFilterTags.push({
      label: `${min} — ${max}`,
      onRemove: () => handleFiltersChange({ ...advancedFilters, minPrice: undefined, maxPrice: undefined }),
    });
  }
  advancedFilters.colors.forEach((color) => {
    activeFilterTags.push({
      label: color,
      onRemove: () => handleFiltersChange({ ...advancedFilters, colors: advancedFilters.colors.filter((c) => c !== color) }),
    });
  });
  advancedFilters.sizes.forEach((size) => {
    activeFilterTags.push({
      label: `${t('shop.sizePrefix')} ${size}`,
      onRemove: () => handleFiltersChange({ ...advancedFilters, sizes: advancedFilters.sizes.filter((s) => s !== size) }),
    });
  });

  const currentSortOption = sortOptions.find((s) => s.value === currentSort);
  const currentSortLabel = currentSortOption ? t(currentSortOption.labelKey) : t('shop.sort.newest');

  return (
    <div className="min-h-screen">
      {/* Hero banner */}
      <div className="relative overflow-hidden bg-[#f3f1eb]">
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-10 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Breadcrumbs
              items={[
                { label: t('common.home'), href: '/' },
                { label: t('shop.collection') },
                ...(currentCategory !== 'All'
                  ? [{ label: t(categoryTranslationKeys[currentCategory] || currentCategory) }]
                  : []),
              ]}
            />
          </div>
          <motion.p
            className="text-xs font-medium tracking-[0.3em] text-[#80603c] uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            BLE$$ P
          </motion.p>
          <motion.h1
            className="mt-3 font-display text-4xl font-light tracking-tight text-neutral-900 md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {t('shop.collection')}
          </motion.h1>
          <motion.div
            className="mt-3 h-[2px] w-16 bg-[#a07a52]"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            style={{ transformOrigin: 'left' }}
          />
          <motion.p
            className="mt-4 max-w-md text-sm text-neutral-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {t('shop.collectionDesc')}
          </motion.p>
        </div>
      </div>

      {/* Sticky bar: categories + sort + mobile filter trigger */}
      <div className="sticky top-0 z-20 border-b border-neutral-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Mobile filter trigger */}
            <FilterPanel
              mode="mobile"
              filtersData={filtersData}
              filters={advancedFilters}
              onFiltersChange={handleFiltersChange}
            />

            {/* Category pills (hidden on small mobile, always on md+) */}
            <div className="hidden gap-2 sm:flex">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => updateParam('category', cat)}
                  className={cn(
                    'relative px-4 py-2 text-xs font-medium tracking-widest uppercase transition-all duration-300',
                    currentCategory === cat
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100',
                  )}
                >
                  {t(categoryTranslationKeys[cat] || cat)}
                  {currentCategory === cat && (
                    <motion.div
                      layoutId="categoryIndicator"
                      className="absolute inset-0 bg-neutral-900 -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Product count */}
            <span className="hidden text-xs text-neutral-500 md:block">
              {t('shop.productCount', { count: totalItems })}
            </span>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-1 text-xs font-medium tracking-wider text-neutral-600 uppercase"
              >
                {currentSortLabel}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    className="absolute right-0 top-full z-30 mt-2 w-48 border border-neutral-100 bg-white py-1 shadow-lg"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          updateParam('sort', opt.value);
                          setSortOpen(false);
                        }}
                        className={cn(
                          'block w-full px-4 py-2 text-left text-sm transition-colors',
                          currentSort === opt.value
                            ? 'bg-neutral-50 font-medium text-neutral-900'
                            : 'text-neutral-600 hover:bg-neutral-50',
                        )}
                      >
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterTags.length > 0 && (
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8">
            {activeFilterTags.map((tag, i) => (
              <span
                key={i}
                className="flex items-center gap-1 whitespace-nowrap border border-neutral-200 px-3 py-1 text-xs text-neutral-600"
              >
                {tag.label}
                <button onClick={tag.onRemove} aria-label={t('filters.remove', { label: tag.label })} className="ml-1 flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-neutral-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => handleFiltersChange({ colors: [], sizes: [], minPrice: undefined, maxPrice: undefined })}
              className="whitespace-nowrap text-xs text-[#80603c] hover:text-[#80603c]"
            >
              {t('filters.clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* Main content: filters sidebar (desktop) + product grid */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex gap-6 lg:gap-12">
          {/* Desktop filter sidebar (rendered by FilterPanel) */}
          <FilterPanel
            filtersData={filtersData}
            filters={advancedFilters}
            onFiltersChange={handleFiltersChange}
          />

          {/* Product grid */}
          <div className="min-w-0 flex-1">
            {/* Mobile category pills */}
            <div className="mb-6 flex gap-2 overflow-x-auto sm:hidden">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => updateParam('category', cat)}
                  className={cn(
                    'whitespace-nowrap px-4 py-2 text-xs font-medium tracking-widest uppercase transition-all',
                    currentCategory === cat
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-50 text-neutral-600',
                  )}
                >
                  {t(categoryTranslationKeys[cat] || cat)}
                </button>
              ))}
            </div>

            <div role="status" className="mb-3 min-h-5 text-xs text-neutral-600">{isLoading ? t('common.loading') : ''}</div>
            {loadError && <div role="alert" className="mb-6 border border-red-200 p-4">{t(loadError)} <button className="underline" onClick={() => setAttempt(value => value + 1)}>{t('common.retry', { defaultValue: 'Retry' })}</button></div>}
            <section aria-label={t('shop.collection')} aria-busy={isLoading}>
            {isLoading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[3/4] bg-neutral-100" />
                    <div className="mt-3 h-4 w-3/4 bg-neutral-100" />
                    <div className="mt-2 h-4 w-1/4 bg-neutral-100" />
                  </div>
                ))}
              </div>
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
                <h3 className="mt-6 text-lg font-medium text-neutral-900">
                  {t('shop.noProductsFound')}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-neutral-500">
                  {t('shop.noProductsDesc')}
                </p>
                <button
                  onClick={() => {
                    setSearchParams(currentSort === 'createdAt:desc' ? {} : { sort: currentSort });
                  }}
                  className="mt-6 text-sm font-medium tracking-widest text-[#80603c] uppercase transition-colors hover:text-[#80603c]"
                >
                  {t('shop.viewAllProducts')}
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
                {products.map(product => <ProductCard key={product.id} product={product} headingLevel={2} />)}
              </div>
            )}

            </section>

            {/* Pagination */}
            <Pagination label={t('shop.pagination')} page={currentPage} totalPages={totalPages} onChange={page => updateParam('page', String(page))} />
          </div>
        </div>
      </div>

      {/* Recently Viewed */}
      <RecentlyViewed />
    </div>
  );
}
