import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
    >
      <Link to={`/products/${product.id}`} className="group block">
        {/* Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
          {product.picture ? (
            <img
              src={product.picture}
              alt={product.name}
              loading="lazy"
              className="h-full w-full scale-[1.02] object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.07]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300">
              No image
            </div>
          )}
          {product.hasLowStock && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute top-3 left-3 z-10 bg-[#c8a97e]/90 px-2.5 py-1 text-[10px] font-semibold tracking-widest text-white uppercase backdrop-blur-sm"
            >
              Low Stock
            </motion.span>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 space-y-1">
          <h3 className="text-sm font-medium text-neutral-900">
            {product.name}
          </h3>
          <p className="text-sm text-neutral-500">
            {formatPrice(product.price)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
