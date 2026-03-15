import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, PackageOpen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';
import type { Product, PaginatedResponse } from '@/lib/types';
import { WishlistButton } from '@/components/common/WishlistButton';
import { CompareButton } from '@/components/common/CompareButton';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { RecentlyViewed } from '@/components/common/RecentlyViewed';
import { FilterPanel, type ActiveFilters } from '@/components/shop/FilterPanel';

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

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function ShopPage() {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);

  const currentCategory = searchParams.get('category') || 'All';
  const currentSort = searchParams.get('sort') || 'createdAt:desc';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Parse advanced filters from URL
  const [advancedFilters, setAdvancedFilters] = useState<ActiveFilters>({
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    colors: searchParams.get('colors') ? searchParams.get('colors')!.split(',') : [],
    sizes: searchParams.get('sizes') ? searchParams.get('sizes')!.split(',') : [],
  });

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('perPage', '12');
      params.set('sort', currentSort);
      if (currentCategory !== 'All') {
        params.set('category', currentCategory.toLowerCase());
      }
      if (advancedFilters.minPrice !== undefined) {
        params.set('minPrice', String(advancedFilters.minPrice));
      }
      if (advancedFilters.maxPrice !== undefined) {
        params.set('maxPrice', String(advancedFilters.maxPrice));
      }
      if (advancedFilters.colors.length > 0) {
        params.set('colors', advancedFilters.colors.join(','));
      }
      if (advancedFilters.sizes.length > 0) {
        params.set('sizes', advancedFilters.sizes.join(','));
      }

      const res = await api.getRaw<PaginatedResponse<Product>>(
        `/products?${params.toString()}`,
      );
      setProducts(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.totalItems);
    } catch (err) {
      console.error('[ShopPage] Failed to fetch products:', err);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentCategory, currentSort, currentPage, advancedFilters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  const handleFiltersChange = (filters: ActiveFilters) => {
    setAdvancedFilters(filters);
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
    setSearchParams(params);
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
      <div className="relative overflow-hidden bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 pt-32 pb-12 sm:px-6 lg:px-8">
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
            className="text-xs font-medium tracking-[0.3em] text-[#c8a97e] uppercase"
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
            className="mt-3 h-[2px] w-16 bg-[#c8a97e]"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            style={{ transformOrigin: 'left' }}
          />
          <motion.p
            className="mt-4 max-w-md text-sm text-neutral-500"
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
            {!isLoading && (
              <span className="hidden text-xs text-neutral-400 md:block">
                {t('shop.productCount', { count: totalItems })}
              </span>
            )}

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
                <button onClick={tag.onRemove} className="ml-1 text-neutral-400 hover:text-neutral-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => handleFiltersChange({ colors: [], sizes: [], minPrice: undefined, maxPrice: undefined })}
              className="whitespace-nowrap text-xs text-[#c8a97e] hover:text-[#b89a6f]"
            >
              {t('filters.clearAll')}
            </button>
          </div>
        )}
      </div>

      {/* Main content: filters sidebar (desktop) + product grid */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex gap-12">
          {/* Desktop filter sidebar (rendered by FilterPanel) */}
          <FilterPanel
            filters={advancedFilters}
            onFiltersChange={handleFiltersChange}
          />

          {/* Product grid */}
          <div className="flex-1">
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

            {isLoading ? (
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
                    handleFiltersChange({ colors: [], sizes: [], minPrice: undefined, maxPrice: undefined });
                    updateParam('category', 'All');
                  }}
                  className="mt-6 text-sm font-medium tracking-widest text-[#c8a97e] uppercase transition-colors hover:text-[#b89a6f]"
                >
                  {t('shop.viewAllProducts')}
                </button>
              </motion.div>
            ) : (
              <motion.div
                className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6"
                initial="hidden"
                animate="visible"
                variants={stagger}
                key={`${currentCategory}-${currentSort}-${currentPage}-${JSON.stringify(advancedFilters)}`}
              >
                {products.map((product) => (
                  <motion.div key={product.id} variants={fadeUp} layout>
                    <div className="group relative">
                      <Link to={`/products/${product.id}`} className="block">
                        <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
                          <img
                            src={product.picture || product.images?.[0]}
                            alt={product.name}
                            className="h-full w-full bg-neutral-100 scale-[1.02] object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.07]"
                          />
                          {product.hasLowStock && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3 }}
                              className="absolute top-3 left-3 z-10 bg-[#c8a97e]/90 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-white uppercase backdrop-blur-sm"
                            >
                              {t('shop.lowStock')}
                            </motion.span>
                          )}
                          <div className="absolute inset-0 flex items-end justify-center bg-black/0 transition-all duration-500 group-hover:bg-black/10">
                            <span className="mb-6 translate-y-4 text-xs font-medium tracking-[0.2em] text-white uppercase opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                              {t('shop.viewProduct')}
                            </span>
                          </div>
                        </div>
                      </Link>
                      <WishlistButton productId={product.id} />
                      <CompareButton productId={product.id} />
                      <div className="mt-4">
                        <h3 className="text-sm font-medium text-neutral-900">
                          {product.name}
                        </h3>
                        <p className="mt-1 text-sm text-neutral-500">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => updateParam('page', String(page))}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center text-sm transition-colors',
                        currentPage === page
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:bg-neutral-100',
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recently Viewed */}
      <RecentlyViewed />
    </div>
  );
}
