import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, PackageOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { WishlistButton } from '@/components/common/WishlistButton';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import type { Product, PaginatedResponse } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function SearchPage() {
  const { formatPrice } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const query = searchParams.get('q') || '';

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setProducts([]);
      setHasSearched(false);
      setTotalItems(0);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await api.getRaw<PaginatedResponse<Product>>(
        `/products?search=${encodeURIComponent(q.trim())}&perPage=24`,
      );
      setProducts(res.data);
      setTotalItems(res.pagination.totalItems);
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) searchProducts(query);
  }, [query, searchProducts]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (value: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set('q', value.trim());
      setSearchParams(params, { replace: true });
    }, 300);
  };

  return (
    <div className="min-h-screen">
      {/* Search header */}
      <div className="bg-neutral-50 pt-32 pb-10">
        <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Search' }]} />
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              defaultValue={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search our collection..."
              className="w-full border border-neutral-200 bg-white py-4 pl-12 pr-4 text-lg text-neutral-900 placeholder:text-neutral-400 focus:border-[#c8a97e] focus:outline-none"
            />
          </div>
          {hasSearched && !isLoading && (
            <p className="mt-4 text-sm text-neutral-500">
              {totalItems} {totalItems === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
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
        ) : !hasSearched ? (
          <motion.div
            className="flex flex-col items-center py-24 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search className="h-12 w-12 text-neutral-200" strokeWidth={1.5} />
            <h3 className="mt-6 text-lg font-medium text-neutral-900">
              Search our collection
            </h3>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              Find exactly what you&apos;re looking for by searching by name or description.
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
            <h3 className="mt-6 text-lg font-medium text-neutral-900">
              No results for &ldquo;{query}&rdquo;
            </h3>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              Try different keywords or browse our full collection.
            </p>
            <Link
              to="/shop"
              className="mt-6 text-sm font-medium tracking-widest text-[#c8a97e] uppercase transition-colors hover:text-[#b89a6f]"
            >
              Browse Collection
            </Link>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4"
            initial="hidden"
            animate="visible"
            variants={stagger}
            key={query}
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
                      <div className="absolute inset-0 flex items-end justify-center bg-black/0 transition-all duration-500 group-hover:bg-black/10">
                        <span className="mb-6 translate-y-4 text-xs font-medium tracking-[0.2em] text-white uppercase opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                          View Product
                        </span>
                      </div>
                    </div>
                  </Link>
                  <WishlistButton productId={product.id} />
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
      </div>
    </div>
  );
}
