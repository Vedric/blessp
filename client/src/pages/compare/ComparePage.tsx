import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Columns3, ShoppingBag, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { useCompare } from '@/context/CompareContext';
import { useCart } from '@/context/CartContext';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import type { Product } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function ComparePage() {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (compareIds.length === 0) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all(
      compareIds.map((id) =>
        api.get<Product>(`/products/${id}`).catch(() => null),
      ),
    ).then((results) => {
      setProducts(results.filter((p): p is Product => p !== null));
      setIsLoading(false);
    });
  }, [compareIds]);

  const handleAddToCart = async (product: Product) => {
    const defaultSize = product.sizes?.[0] || 'M';
    const defaultColor = product.colors?.[0] || 'Black';
    await addToCart(product.id, defaultSize, defaultColor, 1);
  };

  // Empty state
  if (!isLoading && products.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="bg-neutral-50 pt-32 pb-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('compare.title') }]} />
          </div>
        </div>
        <motion.div
          className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-50">
            <Columns3 className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
          </div>
          <h3 className="mt-6 text-lg font-medium text-neutral-900">
            {t('compare.noProducts')}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-neutral-500">
            {t('compare.noProductsDesc')}
          </p>
          <Link
            to="/shop"
            className="mt-6 flex items-center gap-2 text-sm font-medium tracking-widest text-[#c8a97e] uppercase transition-colors hover:text-[#b89a6f]"
          >
            {t('compare.browseCollection')}
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    );
  }

  const comparisonRows: {
    label: string;
    render: (product: Product) => React.ReactNode;
  }[] = [
    {
      label: t('compare.image'),
      render: (product) => (
        <Link to={`/products/${product.id}`} className="block">
          <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
            <img
              src={product.picture || product.images?.[0]}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </div>
        </Link>
      ),
    },
    {
      label: t('compare.name'),
      render: (product) => (
        <Link
          to={`/products/${product.id}`}
          className="text-sm font-medium text-neutral-900 transition-colors hover:text-[#c8a97e]"
        >
          {product.name}
        </Link>
      ),
    },
    {
      label: t('compare.price'),
      render: (product) => (
        <span className="text-sm font-semibold text-neutral-900">
          {formatPrice(product.price)}
        </span>
      ),
    },
    {
      label: t('compare.description'),
      render: (product) => (
        <p className="text-xs leading-relaxed text-neutral-500">
          {product.description || t('compare.noDescription')}
        </p>
      ),
    },
    {
      label: t('compare.category'),
      render: (product) => (
        <span className="inline-block border border-neutral-200 px-3 py-1 text-xs font-medium tracking-wider text-neutral-600 uppercase">
          {product.category}
        </span>
      ),
    },
    {
      label: t('compare.sizes'),
      render: (product) =>
        product.sizes?.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map((size) => (
              <span
                key={size}
                className="flex h-8 w-8 items-center justify-center border border-neutral-200 text-xs text-neutral-600"
              >
                {size}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-neutral-400">N/A</span>
        ),
    },
    {
      label: t('compare.colors'),
      render: (product) =>
        product.colors?.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {product.colors.map((color) => (
              <span
                key={color}
                className="border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600"
              >
                {color}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-neutral-400">N/A</span>
        ),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-neutral-50 pt-32 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('compare.title') }]} />
          </div>
          <motion.p
            className="text-xs font-medium tracking-[0.3em] text-[#c8a97e] uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {t('compare.sideBySide')}
          </motion.p>
          <motion.h1
            className="mt-3 font-display text-4xl font-light tracking-tight text-neutral-900 md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {t('compare.compareProducts')}
          </motion.h1>
          <motion.div
            className="mt-3 h-[2px] w-16 bg-[#c8a97e]"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            style={{ transformOrigin: 'left' }}
          />
          <motion.div
            className="mt-4 flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="text-sm text-neutral-500">
              {t('compare.comparingCount', { count: products.length })}
            </p>
            <button
              onClick={clearCompare}
              className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-900"
            >
              {t('compare.clearAll')}
            </button>
          </motion.div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          </div>
        ) : (
          <motion.div
            className="overflow-x-auto"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr>
                  <th className="w-32 p-0" />
                  {products.map((product) => (
                    <th
                      key={product.id}
                      className="relative p-4 text-left align-top"
                    >
                      <button
                        onClick={() => removeFromCompare(product.id)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                        aria-label={`Remove ${product.name} from comparison`}
                      >
                        <X size={14} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-t border-neutral-100">
                    <td className="p-4 align-top">
                      <span className="text-xs font-medium tracking-wider text-neutral-400 uppercase">
                        {row.label}
                      </span>
                    </td>
                    {products.map((product) => (
                      <td
                        key={product.id}
                        className="p-4 align-top"
                      >
                        {row.render(product)}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Actions row */}
                <tr className="border-t border-neutral-100">
                  <td className="p-4 align-top">
                    <span className="text-xs font-medium tracking-wider text-neutral-400 uppercase">
                      {t('compare.actions')}
                    </span>
                  </td>
                  {products.map((product) => (
                    <td key={product.id} className="space-y-2 p-4 align-top">
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="flex w-full items-center justify-center gap-2 bg-neutral-900 px-4 py-3 text-xs font-medium tracking-wider text-white uppercase transition-colors hover:bg-neutral-800"
                      >
                        <ShoppingBag size={14} />
                        {t('product.addToCart')}
                      </button>
                      <Link
                        to={`/products/${product.id}`}
                        className="block w-full border border-neutral-200 px-4 py-3 text-center text-xs font-medium tracking-wider text-neutral-600 uppercase transition-colors hover:border-neutral-900 hover:text-neutral-900"
                      >
                        {t('shop.viewProduct')}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </motion.div>
        )}
      </div>
    </div>
  );
}
