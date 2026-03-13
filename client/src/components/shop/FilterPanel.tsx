import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
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

export interface ActiveFilters {
  minPrice?: number;
  maxPrice?: number;
  colors: string[];
  sizes: string[];
}

interface FiltersData {
  categories: string[];
  colors: string[];
  sizes: string[];
  priceRange: { min: number; max: number };
}

interface FilterPanelProps {
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
}

export function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const { formatPrice } = useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [filtersData, setFiltersData] = useState<FiltersData | null>(null);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const data = await api.get<FiltersData>('/products/filters');
        setFiltersData(data);
      } catch {
        // Filters are a progressive enhancement
      }
    };
    fetchFilters();
  }, []);

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

  if (!filtersData) return null;

  const filterContent = (
    <div className="space-y-8">
      {/* Price range */}
      <div>
        <h4 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
          Price Range
        </h4>
        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">$</span>
            <input
              type="number"
              placeholder={String(filtersData.priceRange.min / 100)}
              value={filters.minPrice !== undefined ? filters.minPrice / 100 : ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  minPrice: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined,
                })
              }
              className="w-full border border-neutral-200 py-2 pl-7 pr-2 text-sm text-neutral-900 focus:border-[#c8a97e] focus:outline-none"
            />
          </div>
          <span className="text-xs text-neutral-400">to</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">$</span>
            <input
              type="number"
              placeholder={String(filtersData.priceRange.max / 100)}
              value={filters.maxPrice !== undefined ? filters.maxPrice / 100 : ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  maxPrice: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined,
                })
              }
              className="w-full border border-neutral-200 py-2 pl-7 pr-2 text-sm text-neutral-900 focus:border-[#c8a97e] focus:outline-none"
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
          <h4 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
            Colors
          </h4>
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
          <h4 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
            Sizes
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {filtersData.sizes.map((size) => (
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
          className="text-xs font-medium tracking-widest text-[#c8a97e] uppercase transition-colors hover:text-[#b89a6f]"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex items-center gap-2 text-xs font-medium tracking-wider text-neutral-600 uppercase lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Desktop sidebar */}
      <div className="hidden w-60 flex-shrink-0 lg:block">
        <div className="sticky top-24">
          <h3 className="text-xs font-medium tracking-[0.2em] text-neutral-900 uppercase">
            Filters
          </h3>
          <div className="mt-6">
            {filterContent}
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
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
              className="fixed left-0 top-0 z-50 flex h-full w-80 flex-col bg-white"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
            >
              <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
                <h3 className="text-xs font-medium tracking-[0.2em] text-neutral-900 uppercase">
                  Filters
                </h3>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-neutral-400 hover:text-neutral-900"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {filterContent}
              </div>
              <div className="border-t border-neutral-100 p-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-full bg-neutral-900 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-[#c8a97e] hover:text-neutral-950"
                >
                  Show Results
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
