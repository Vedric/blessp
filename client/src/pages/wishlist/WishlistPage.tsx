import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/context/WishlistContext';
import { useCurrency } from '@/context/CurrencyContext';
import { WishlistButton } from '@/components/common/WishlistButton';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function WishlistPage() {
  const { wishlistItems, isLoading } = useWishlist();
  const { formatPrice } = useCurrency();

  return (
    <div className="min-h-screen">
      {/* Hero banner */}
      <div className="relative overflow-hidden bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 pt-32 pb-12 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Wishlist' }]} />
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
            My Wishlist
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
            Pieces you love, saved for later.
          </motion.p>
        </div>
      </div>

      {/* Wishlist Grid */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-neutral-100" />
                <div className="mt-3 h-4 w-3/4 bg-neutral-100" />
                <div className="mt-2 h-4 w-1/4 bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : wishlistItems.length === 0 ? (
          <motion.div
            className="flex flex-col items-center py-24 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-50">
              <Heart className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
            </div>
            <h3 className="mt-6 text-lg font-medium text-neutral-900">
              Your wishlist is empty
            </h3>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              Browse our collection and save the pieces you love.
            </p>
            <Link
              to="/shop"
              className="mt-6 bg-neutral-900 px-8 py-3 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
            >
              Explore the Collection
            </Link>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {wishlistItems.map((item) => (
              <motion.div key={item.id} variants={fadeUp} layout>
                <div className="group relative">
                  <Link to={`/products/${item.product.id}`} className="block">
                    <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50">
                      <img
                        src={item.product.picture || item.product.images?.[0]}
                        alt={item.product.name}
                        className="h-full w-full scale-[1.02] object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.07]"
                      />
                      <div className="absolute inset-0 flex items-end justify-center bg-black/0 transition-all duration-500 group-hover:bg-black/10">
                        <span className="mb-6 translate-y-4 text-xs font-medium tracking-[0.2em] text-white uppercase opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                          View Product
                        </span>
                      </div>
                    </div>
                  </Link>
                  <WishlistButton productId={item.product.id} />
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-neutral-900">
                      {item.product.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {formatPrice(item.product.price)}
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
