import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import type { Product } from '@/lib/types';

interface CompleteLookProps {
  productId: string;
  currentProduct: Product;
}

const fadeSlideUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export function CompleteLook({ productId, currentProduct }: CompleteLookProps) {
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();

  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addingSet, setAddingSet] = useState(false);

  const fetchCompleteLook = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Product[]>(`/products/${productId}/complete-look`);
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchCompleteLook();
  }, [fetchCompleteLook]);

  const handleQuickAdd = async (product: Product) => {
    setAddingId(product.id);
    try {
      const defaultColor = product.colors[0] ?? '';
      const defaultSize = product.sizes[0] ?? '';
      await addToCart(product.id, defaultSize, defaultColor, 1);
    } catch {
      // Cart context handles error display
    } finally {
      setAddingId(null);
    }
  };

  const handleShopTheSet = async (suggestion: Product) => {
    setAddingSet(true);
    try {
      const currentColor = currentProduct.colors[0] ?? '';
      const currentSize = currentProduct.sizes[0] ?? '';
      const suggestedColor = suggestion.colors[0] ?? '';
      const suggestedSize = suggestion.sizes[0] ?? '';

      await addToCart(currentProduct.id, currentSize, currentColor, 1);
      await addToCart(suggestion.id, suggestedSize, suggestedColor, 1);
    } catch {
      // Cart context handles error display
    } finally {
      setAddingSet(false);
    }
  };

  if (isLoading || suggestions.length === 0) {
    return null;
  }

  // Calculate the set total (current product + first suggestion) with a 10% set discount
  const primarySuggestion = suggestions[0];
  const setTotalBeforeDiscount = currentProduct.price + primarySuggestion.price;
  const setDiscount = Math.round(setTotalBeforeDiscount * 0.1);
  const setTotalAfterDiscount = setTotalBeforeDiscount - setDiscount;

  return (
    <motion.section
      className="mt-24 border-t border-neutral-100 pt-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={staggerContainer}
    >
      <motion.h2
        className="font-display text-2xl font-light tracking-tight text-neutral-900 md:text-3xl"
        variants={fadeSlideUp}
      >
        Complete the Look
      </motion.h2>
      <motion.div className="mt-2 h-px w-12 bg-[#c8a97e]" variants={fadeSlideUp} />

      {/* Set pricing banner */}
      <motion.div
        className="mt-8 flex flex-wrap items-center gap-4 border border-[#c8a97e]/30 bg-[#c8a97e]/5 px-6 py-4"
        variants={fadeSlideUp}
      >
        <Sparkles className="h-5 w-5 text-[#c8a97e]" />
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium tracking-wide text-neutral-900 uppercase">
            Shop the Set
          </span>
          <span className="text-sm text-neutral-500 line-through">
            {formatPrice(setTotalBeforeDiscount)}
          </span>
          <span className="text-lg font-medium text-[#c8a97e]">
            {formatPrice(setTotalAfterDiscount)}
          </span>
          <span className="rounded-sm bg-[#c8a97e]/10 px-2 py-0.5 text-xs font-medium text-[#c8a97e]">
            Save {formatPrice(setDiscount)}
          </span>
        </div>
        <motion.button
          onClick={() => handleShopTheSet(primarySuggestion)}
          disabled={addingSet}
          className="ml-auto flex items-center gap-2 bg-neutral-900 px-5 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-all hover:bg-[#c8a97e] hover:text-neutral-950 disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          {addingSet ? 'Adding...' : 'Add Both to Cart'}
        </motion.button>
      </motion.div>

      {/* Suggested products grid */}
      <motion.div
        className="mt-10 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4"
        variants={staggerContainer}
      >
        {suggestions.map((product) => (
          <motion.div
            key={product.id}
            className="group relative"
            variants={fadeSlideUp}
          >
            <Link to={`/products/${product.id}`} className="block">
              <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                <img
                  src={product.picture || product.images?.[0]}
                  alt={product.name}
                  className="h-full w-full scale-[1.02] bg-neutral-100 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
                />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-neutral-900">
                  {product.name}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>

            {/* Quick-add button */}
            <motion.button
              onClick={(e) => {
                e.preventDefault();
                handleQuickAdd(product);
              }}
              disabled={addingId === product.id}
              className="mt-3 flex w-full items-center justify-center gap-2 border border-neutral-200 py-2.5 text-xs font-medium tracking-widest text-neutral-700 uppercase transition-all hover:border-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {addingId === product.id ? 'Adding...' : 'Add to Cart'}
            </motion.button>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
