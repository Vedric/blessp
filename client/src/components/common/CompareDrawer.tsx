import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useCompare } from '@/context/CompareContext';
import type { Product } from '@/lib/types';

export function CompareDrawer() {
  const navigate = useNavigate();
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const [products, setProducts] = useState<Record<string, Product>>({});

  // Fetch product data for thumbnails
  useEffect(() => {
    const missingIds = compareIds.filter((id) => !products[id]);
    if (missingIds.length === 0) return;

    missingIds.forEach((id) => {
      api
        .get<Product>(`/products/${id}`)
        .then((product) => {
          setProducts((prev) => ({ ...prev, [id]: product }));
        })
        .catch(() => {
          // Product may have been removed; silently ignore
        });
    });
  }, [compareIds, products]);

  // Clean up cached products that are no longer in the compare list
  useEffect(() => {
    setProducts((prev) => {
      const next: Record<string, Product> = {};
      for (const id of compareIds) {
        if (prev[id]) next[id] = prev[id];
      }
      return next;
    });
  }, [compareIds]);

  const handleCompareNow = () => {
    navigate('/compare');
  };

  const isVisible = compareIds.length > 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            {/* Product thumbnails */}
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-medium tracking-wider text-neutral-500 uppercase sm:block">
                Compare ({compareIds.length}/3)
              </span>

              <div className="flex items-center gap-2">
                {compareIds.map((id) => {
                  const product = products[id];
                  return (
                    <motion.div
                      key={id}
                      className="group relative"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="h-14 w-14 overflow-hidden border border-neutral-200 bg-neutral-100 sm:h-16 sm:w-16">
                        {product && (
                          <img
                            src={product.picture || product.images?.[0]}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCompare(id)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove from comparison"
                      >
                        <X size={10} />
                      </button>
                    </motion.div>
                  );
                })}

                {/* Empty slots */}
                {Array.from({ length: 3 - compareIds.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex h-14 w-14 items-center justify-center border border-dashed border-neutral-300 bg-neutral-50 sm:h-16 sm:w-16"
                  >
                    <span className="text-xs text-neutral-300">+</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={clearCompare}
                className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-900"
              >
                Clear
              </button>
              <button
                onClick={handleCompareNow}
                disabled={compareIds.length < 2}
                className="flex items-center gap-2 bg-neutral-900 px-5 py-2.5 text-xs font-medium tracking-wider text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Compare Now
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
