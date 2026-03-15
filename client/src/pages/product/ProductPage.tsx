import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, ShoppingBag, ChevronDown, Ruler, Truck, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { SizeGuide } from '@/components/common/SizeGuide';
import { WishlistButton } from '@/components/common/WishlistButton';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { ReviewSection } from '@/components/product/ReviewSection';
import { SocialShare } from '@/components/product/SocialShare';
import { CompleteLook } from '@/components/product/CompleteLook';
import { CompareButton } from '@/components/common/CompareButton';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import type { Product, ProductVariant, PaginatedResponse } from '@/lib/types';

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

const slideUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export default function ProductPage() {
  const { t } = useTranslation();
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { addProduct: addToRecentlyViewed } = useRecentlyViewed();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [siblingProducts, setSiblingProducts] = useState<Product[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoading(true);
      try {
        const data = await api.get<Product>(`/products/${productId}`);
        setProduct(data);
        addToRecentlyViewed(data.id);
        if (data.colors.length > 0) setSelectedColor(data.colors[0]);
        if (data.sizes.length > 0) setSelectedSize(data.sizes[0]);

        // Fetch variant stock info
        try {
          const variantData = await api.get<ProductVariant[]>(`/products/${productId}/variants`);
          setVariants(variantData);
        } catch {
          setVariants([]);
        }
      } catch {
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    };
    if (productId) fetchProduct();
  }, [productId]);

  // Fetch sibling products (same category) for color variant linking
  useEffect(() => {
    const fetchSiblings = async () => {
      if (!product?.category) return;
      try {
        const res = await api.getRaw<PaginatedResponse<Product>>(
          `/products?category=${product.category}&perPage=20`,
        );
        const siblings = res.data.filter((p) => p.id !== product.id);
        setSiblingProducts(siblings);
        setRelatedProducts(siblings.slice(0, 4));
      } catch {
        setSiblingProducts([]);
        setRelatedProducts([]);
      }
    };
    fetchSiblings();
  }, [product?.category, product?.id]);

  // Build a unified color map: color -> product (for cross-product color switching)
  const colorVariants = useMemo(() => {
    if (!product) return [];
    const colorMap = new Map<string, { color: string; product: Product }>();

    // Current product's colors first
    for (const color of product.colors) {
      colorMap.set(color.toLowerCase(), { color, product });
    }

    // Add sibling product colors
    for (const sibling of siblingProducts) {
      for (const color of sibling.colors) {
        const key = color.toLowerCase();
        if (!colorMap.has(key)) {
          colorMap.set(key, { color, product: sibling });
        }
      }
    }

    return Array.from(colorMap.values());
  }, [product, siblingProducts]);

  const handleColorSwitch = (color: string, targetProduct: Product) => {
    if (targetProduct.id === product?.id) {
      // Same product, just switch color
      setSelectedColor(color);
    } else {
      // Different product, navigate with crossfade
      navigate(`/products/${targetProduct.id}`, { replace: true });
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setIsAdding(true);
    try {
      await addToCart(product.id, selectedSize, selectedColor, quantity);
    } catch {
      // Cart context handles error display
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-32 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="animate-pulse">
            <div className="aspect-[3/4] bg-neutral-100" />
            <div className="mt-4 flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 w-20 bg-neutral-100" />
              ))}
            </div>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-3/4 bg-neutral-100" />
            <div className="h-6 w-1/4 bg-neutral-100" />
            <div className="mt-8 h-12 w-full bg-neutral-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">{t('product.notFound')}</p>
      </div>
    );
  }

  const allImages = [
    product.picture,
    ...product.images.filter((img) => img !== product.picture),
  ].filter(Boolean);

  // Stock helpers
  const getVariantStock = (size: string, color: string): number | null => {
    const variant = variants.find((v) => v.size === size && v.color === color);
    return variant ? variant.stock : null;
  };

  const currentStock = selectedSize && selectedColor
    ? getVariantStock(selectedSize, selectedColor)
    : null;

  const isOutOfStock = currentStock !== null && currentStock <= 0;
  const isLowStock = currentStock !== null && currentStock > 0 && currentStock <= 5;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-32 pb-24 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Breadcrumbs
          items={[
            { label: t('common.home'), href: '/' },
            { label: t('common.shop'), href: '/shop' },
            ...(product.category
              ? [{ label: product.category, href: `/shop?category=${product.category}` }]
              : []),
            { label: product.name },
          ]}
        />
      </div>
      <motion.div
        className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-20"
        initial="hidden"
        animate="visible"
      >
        {/* Images */}
        <motion.div variants={fadeIn}>
          <div className="relative">
            {product && <WishlistButton productId={product.id} />}
            {product && <CompareButton productId={product.id} />}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${product.id}-${selectedImage}`}
              className="aspect-[3/4] overflow-hidden bg-neutral-100"
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <img
                src={allImages[selectedImage] || product.picture}
                alt={product.name}
                className="h-full w-full scale-[1.02] bg-neutral-100 object-cover"
              />
            </motion.div>
          </AnimatePresence>

          {allImages.length > 1 && (
            <div className="mt-4 flex gap-2">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    'h-20 w-20 overflow-hidden border-2 transition-colors',
                    selectedImage === i
                      ? 'border-neutral-900'
                      : 'border-transparent hover:border-neutral-300',
                  )}
                >
                  <img
                    src={img}
                    alt={`${product.name} view ${i + 1}`}
                    className="h-full w-full scale-[1.02] object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          </div>
        </motion.div>

        {/* Product Info */}
        <motion.div className="lg:sticky lg:top-32 lg:self-start" variants={slideUp}>
          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900 md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 text-xl text-neutral-700">
            {formatPrice(product.price)}
          </p>

          {/* Stock badge */}
          {currentStock !== null && (
            <AnimatePresence mode="wait">
              <motion.div
                key={isOutOfStock ? 'oos' : isLowStock ? 'low' : 'in'}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.25 }}
                className="mt-3"
              >
                {isOutOfStock ? (
                  <span className="inline-block rounded-sm bg-neutral-900 px-3 py-1 text-xs font-medium tracking-wider text-white uppercase">
                    {t('product.outOfStock')}
                  </span>
                ) : isLowStock ? (
                  <span className="inline-block rounded-sm bg-[#c8a97e]/15 px-3 py-1 text-xs font-medium tracking-wider text-[#c8a97e] uppercase">
                    {t('product.onlyXLeft', { count: currentStock })}
                  </span>
                ) : (
                  <span className="inline-block rounded-sm bg-emerald-50 px-3 py-1 text-xs font-medium tracking-wider text-emerald-700 uppercase">
                    {t('product.inStock')}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Color selector (unified across sibling products) */}
          {colorVariants.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t('product.color')}: {selectedColor}
              </p>
              <div className="mt-3 flex gap-3">
                {colorVariants.map(({ color, product: targetProduct }) => {
                  const colorHexMap: Record<string, string> = {
                    black: '#000000',
                    blue: '#2563eb',
                    pink: '#ec4899',
                    red: '#ef4444',
                    white: '#ffffff',
                    gray: '#6b7280',
                    grey: '#6b7280',
                    navy: '#1e3a5f',
                    green: '#22c55e',
                    beige: '#d4c5a9',
                    brown: '#8B4513',
                    cream: '#FFFDD0',
                    olive: '#808000',
                    purple: '#9333ea',
                    orange: '#f97316',
                    yellow: '#eab308',
                    burgundy: '#800020',
                    khaki: '#c3b091',
                  };
                  const isCurrentColor =
                    targetProduct.id === product.id &&
                    color.toLowerCase() === selectedColor.toLowerCase();
                  const isSiblingProduct = targetProduct.id !== product.id;

                  return (
                    <motion.button
                      key={`${targetProduct.id}-${color}`}
                      onClick={() => handleColorSwitch(color, targetProduct)}
                      className={cn(
                        'relative h-8 w-8 rounded-full border-2 transition-all',
                        isCurrentColor
                          ? 'border-neutral-900 ring-2 ring-neutral-900 ring-offset-2'
                          : isSiblingProduct
                            ? 'border-neutral-200 hover:border-[#c8a97e] hover:ring-1 hover:ring-[#c8a97e] hover:ring-offset-1'
                            : 'border-neutral-200 hover:border-neutral-400',
                      )}
                      style={{
                        backgroundColor: colorHexMap[color.toLowerCase()] || color,
                      }}
                      title={`${color}${isSiblingProduct ? ` (${targetProduct.name})` : ''}`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Size selector */}
          {product.sizes.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t('product.size')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const sizeStock = selectedColor
                    ? getVariantStock(size, selectedColor)
                    : null;
                  const sizeOutOfStock = sizeStock !== null && sizeStock <= 0;

                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      disabled={sizeOutOfStock}
                      className={cn(
                        'flex h-10 min-w-[3rem] items-center justify-center border px-4 text-sm font-medium transition-colors',
                        sizeOutOfStock
                          ? 'cursor-not-allowed border-neutral-100 text-neutral-300 line-through'
                          : selectedSize === size
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-200 text-neutral-700 hover:border-neutral-400',
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setSizeGuideOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-[#c8a97e]"
              >
                <Ruler className="h-3.5 w-3.5" />
                {t('product.sizeGuide')}
              </button>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-8">
            <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
              {t('product.quantity')}
            </p>
            <div className="mt-3 flex items-center border border-neutral-200 w-fit">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-12 w-12 items-center justify-center text-neutral-600 transition-colors hover:text-neutral-900"
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex h-12 w-14 items-center justify-center text-sm font-medium text-neutral-900">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-12 w-12 items-center justify-center text-neutral-600 transition-colors hover:text-neutral-900"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Add to Cart */}
          <motion.button
            onClick={handleAddToCart}
            disabled={isAdding || isOutOfStock}
            className={cn(
              'mt-10 flex w-full items-center justify-center gap-3 px-8 py-4 text-sm font-medium tracking-widest uppercase transition-all disabled:opacity-50',
              isOutOfStock
                ? 'cursor-not-allowed bg-neutral-200 text-neutral-400'
                : 'bg-neutral-900 text-white hover:bg-[#c8a97e] hover:text-neutral-950',
            )}
            whileHover={isOutOfStock ? {} : { scale: 1.02 }}
            whileTap={isOutOfStock ? {} : { scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <ShoppingBag className="h-4 w-4" />
            {isOutOfStock ? t('product.outOfStock') : isAdding ? t('product.adding') : t('product.addToCart')}
          </motion.button>

          {/* Delivery estimation: surface shipping expectations early to reduce purchase hesitation */}
          <div className="mt-8 space-y-3 border border-neutral-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 flex-shrink-0 text-neutral-400" />
              <div>
                <p className="text-sm tracking-wide text-neutral-700">
                  {t('delivery.freeShipping')}
                </p>
                <p className="text-xs tracking-wider text-neutral-400">
                  {t('delivery.estimatedDelivery', {
                    range: (() => {
                      const start = new Date();
                      start.setDate(start.getDate() + 5);
                      const end = new Date();
                      end.setDate(end.getDate() + 7);
                      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
                      return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
                    })(),
                  })}
                </p>
              </div>
            </div>
            <div className="h-px bg-neutral-100" />
            <div className="flex items-center gap-3">
              <RotateCcw className="h-4 w-4 flex-shrink-0 text-neutral-400" />
              <p className="text-sm tracking-wide text-neutral-700">
                {t('delivery.returns')}
              </p>
            </div>
          </div>

          {/* Description accordion */}
          <div className="mt-10 border-t border-neutral-100">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="flex w-full items-center justify-between py-5 text-left"
            >
              <span className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                {t('product.descriptionDetails')}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-neutral-400 transition-transform',
                  detailsOpen && 'rotate-180',
                )}
              />
            </button>
            <AnimatePresence>
              {detailsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pb-6 text-sm leading-relaxed text-neutral-600 space-y-4">
                    <p>{product.description}</p>
                    {product.details && <p>{product.details}</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Social sharing */}
          <SocialShare productName={product.name} className="mt-6 border-t border-neutral-100 pt-6" />
        </motion.div>
      </motion.div>

      {/* Complete the Look */}
      {productId && product && (
        <CompleteLook productId={productId} currentProduct={product} />
      )}

      {/* You May Also Like */}
      {relatedProducts.length > 0 && (
        <motion.section
          className="mt-24 border-t border-neutral-100 pt-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          <motion.h2
            className="font-display text-2xl font-light tracking-tight text-neutral-900 md:text-3xl"
            variants={slideUp}
          >
            {t('product.youMayAlsoLike')}
          </motion.h2>
          <motion.div className="mt-2 h-px w-12 bg-[#c8a97e]" variants={slideUp} />

          <motion.div
            className="mt-10 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4"
            variants={{
              visible: { transition: { staggerChildren: 0.08 } },
            }}
          >
            {relatedProducts.map((related) => (
              <motion.div key={related.id} variants={slideUp} className="relative">
                <WishlistButton productId={related.id} />
                <Link to={`/products/${related.id}`} className="group block">
                  <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                    <img
                      src={related.picture || related.images?.[0]}
                      alt={related.name}
                      className="h-full w-full scale-[1.02] bg-neutral-100 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
                    />
                  </div>
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-neutral-900">
                      {related.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {formatPrice(related.price)}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* Reviews */}
      {productId && <ReviewSection productId={productId} />}

      <SizeGuide isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </div>
  );
}
