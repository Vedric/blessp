import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import type { Product } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export function RecentlyViewed() {
  const { formatPrice } = useCurrency();
  const { recentIds } = useRecentlyViewed();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (recentIds.length === 0) return;

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        // Fetch each product individually, filtering out failures
        const results = await Promise.allSettled(
          recentIds.slice(0, 6).map((id) => api.get<Product>(`/products/${id}`)),
        );

        const fetched = results
          .filter(
            (result): result is PromiseFulfilledResult<Product> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value);

        // Preserve the order from recentIds
        const ordered = recentIds
          .map((id) => fetched.find((p) => p.id === id))
          .filter((p): p is Product => p !== undefined)
          .slice(0, 6);

        setProducts(ordered);
      } catch {
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [recentIds]);

  if (recentIds.length === 0 || (products.length === 0 && !isLoading)) {
    return null;
  }

  return (
    <motion.section
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={stagger}
    >
      <motion.h2
        className="font-display text-2xl font-light tracking-tight text-neutral-900 md:text-3xl"
        variants={fadeUp}
      >
        Recently Viewed
      </motion.h2>
      <motion.div className="mt-2 h-px w-12 bg-[#c8a97e]" variants={fadeUp} />

      {isLoading ? (
        <div className="mt-8 flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-48 flex-shrink-0 animate-pulse">
              <div className="aspect-[3/4] bg-neutral-100" />
              <div className="mt-3 h-4 w-3/4 bg-neutral-100" />
              <div className="mt-2 h-4 w-1/3 bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          className="mt-8 flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
          variants={stagger}
        >
          {products.map((product) => (
            <motion.div
              key={product.id}
              className="w-48 flex-shrink-0"
              variants={fadeUp}
            >
              <Link to={`/products/${product.id}`} className="group block">
                <div className="aspect-[3/4] overflow-hidden bg-neutral-50">
                  <img
                    src={product.picture || product.images?.[0]}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full scale-[1.02] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
                  />
                </div>
                <div className="mt-3">
                  <h3 className="truncate text-sm font-medium text-neutral-900">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatPrice(product.price)}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.section>
  );
}
