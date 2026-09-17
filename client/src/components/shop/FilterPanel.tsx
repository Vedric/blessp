import { useDialogFocus } from '@/hooks/useDialogFocus';
import { createPortal } from 'react-dom';
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/context/CurrencyContext';
import { cn } from '@/lib/utils';

const colorMap: Record<string, string> = {
  black: '#171717',
  blue: '#2563eb',
  pink: '#ec4899',
  white: '#f5f5f5',
  gray: '#6b7280',
  navy: '#1e3a5f',
};

const clothingSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
function compareSizes(a: string, b: string): number {
  const rank = (size: string) => {
    const index = clothingSizes.indexOf(size.toUpperCase());
    return index === -1 ? clothingSizes.length : index;
  };
  return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true });
}

export interface ActiveFilters {
  minPrice?: number;
  maxPrice?: number;
  colors: string[];
  sizes: string[];
}

export interface FiltersData {
  categories: string[];
  colors: string[];
  sizes: string[];
  priceRange: { min: number; max: number };
}

interface FilterPanelProps {
  mode?: 'mobile' | 'desktop';
  filters: ActiveFilters;
  filtersData: FiltersData | null;
  onFiltersChange: (filters: ActiveFilters, options?: { replace?: boolean }) => void;
}

export function FilterPanel({ filters, filtersData, onFiltersChange, mode = 'desktop' }: FilterPanelProps) {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => setMobileOpen(false), []);
  useDialogFocus(mobileOpen, panel, closePanel);
  const activeCount =
    (filters.minPrice !== undefined ? 1 : 0) +
    (filters.maxPrice !== undefined ? 1 : 0) +
    filters.colors.length +
    filters.sizes.length;

  const toggleColor = (color: string) => {
    const next = filters.colors.includes(color)
      ? filters.colors.filter((c) => c !== color)
      : [...filters.colors, color];
    onFiltersChange({ ...filters, colors: next });
  };

  const toggleSize = (size: string) => {
    const next = filters.sizes.includes(size)
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onFiltersChange({ ...filters, sizes: next });
  };

  const clearAll = () => {
    onFiltersChange({ colors: [], sizes: [], minPrice: undefined, maxPrice: undefined });
  };

  if (!filtersData) {
    // Reserve the final controls' footprint while facets load, so the
    // catalogue and toolbar do not move when a slower response arrives.
    return mode === 'desktop'
      ? <div aria-hidden="true" className="hidden w-60 flex-shrink-0 lg:block" />
      : <button type="button" disabled aria-busy="true" className="flex items-center gap-2 text-xs font-medium tracking-wider text-neutral-600 uppercase lg:hidden"><SlidersHorizontal className="h-4 w-4" />{t('filters.title')}</button>;
  }

  const filterContent = (
    <div className="space-y-8">
      {/* Price range */}
      <div>
        <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
          {t('filters.priceRange')}
        </h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">$</span>
            <input
              type="number"
              min="0"
              aria-label={t('filters.minPrice', { defaultValue: 'Minimum price' })}
              placeholder={String(filtersData.priceRange.min / 100)}
              value={filters.minPrice !== undefined ? filters.minPrice / 100 : ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  minPrice: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined,
                }, { replace: true })
              }
              className="w-full border border-neutral-200 py-2 pl-7 pr-2 text-sm text-neutral-900 focus:border-[#a07a52] focus:outline-none"
            />
          </div>
          <span className="text-xs text-neutral-500">to</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">$</span>
            <input
              type="number"
              min="0"
              aria-label={t('filters.maxPrice', { defaultValue: 'Maximum price' })}
              placeholder={String(filtersData.priceRange.max / 100)}
              value={filters.maxPrice !== undefined ? filters.maxPrice / 100 : ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  maxPrice: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined,
                }, { replace: true })
              }
              className="w-full border border-neutral-200 py-2 pl-7 pr-2 text-sm text-neutral-900 focus:border-[#a07a52] focus:outline-none"
            />
          </div>
        </div>
        {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
          <p className="mt-2 text-xs text-neutral-500">
            {filters.minPrice !== undefined ? formatPrice(filters.minPrice) : '$0'}
            {' '}—{' '}
            {filters.maxPrice !== undefined ? formatPrice(filters.maxPrice) : formatPrice(filtersData.priceRange.max)}
          </p>
        )}
      </div>

      {/* Colors */}
      {filtersData.colors.length > 0 && (
        <div>
          <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
            {t('filters.colors')}
          </h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {filtersData.colors.map((color) => (
              <button
                key={color}
                onClick={() => toggleColor(color)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-all',
                  filters.colors.includes(color)
                    ? 'border-neutral-900 ring-2 ring-neutral-900 ring-offset-2'
                    : 'border-neutral-200 hover:border-neutral-400',
                )}
                style={{
                  backgroundColor: colorMap[color.toLowerCase()] || color,
                }}
                title={color}
                aria-label={color}
                aria-pressed={filters.colors.includes(color)}
              />
            ))}
          </div>
          {filters.colors.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500">
              {filters.colors.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Sizes */}
      {filtersData.sizes.length > 0 && (
        <div>
          <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
            {t('filters.sizes')}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...filtersData.sizes].sort(compareSizes).map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={cn(
                  'flex h-10 min-w-[3rem] items-center justify-center border px-3 text-xs font-medium transition-colors',
                  filters.sizes.includes(size)
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 text-neutral-600 hover:border-neutral-400',
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="text-xs font-medium tracking-widest text-[#80603c] uppercase transition-colors hover:text-[#80603c]"
        >
          {t('filters.clearAllFilters')}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      {mode === 'mobile' && <button
        onClick={() => setMobileOpen(true)}
        className="flex items-center gap-2 text-xs font-medium tracking-wider text-neutral-600 uppercase lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {t('filters.title')}
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </button>}

      {/* Desktop sidebar */}
      {mode === 'desktop' && <div className="hidden w-60 flex-shrink-0 lg:block">
        <div className="sticky top-24">
          <h2 className="text-xs font-medium tracking-[0.2em] text-neutral-900 uppercase">
            {t('filters.title')}
          </h2>
          <div className="mt-6">
            {filterContent}
          </div>
        </div>
      </div>}

      {/* Mobile overlay */}
      {createPortal(<AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('filters.title')}
              className="fixed left-0 top-0 z-50 flex h-full w-80 max-w-full flex-col bg-white"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
            >
              <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
                <h2 className="text-xs font-medium tracking-[0.2em] text-neutral-900 uppercase">
                  {t('filters.title')}
                </h2>
                <button
                  onClick={closePanel} aria-label={t('common.close')}
                  className="text-neutral-500 hover:text-neutral-900"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {filterContent}
              </div>
              <div className="border-t border-neutral-100 p-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-full bg-neutral-900 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-[#a07a52] hover:text-neutral-950"
                >
                  {t('filters.showResults')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
}
