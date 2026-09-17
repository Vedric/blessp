import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/context/CurrencyContext';
import { WishlistButton } from './WishlistButton';
import { CompareButton } from './CompareButton';
import type { Product } from '@/lib/types';

export function ProductCard({ product, headingLevel = 3 }: { product: Product; headingLevel?: 2 | 3 }) {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const picture = product.picture || product.images?.[0];
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="product-card group relative min-w-0">
      <Link to={`/products/${product.id}`} className="block" aria-label={product.name}>
        <div className="relative aspect-[3/4] overflow-hidden bg-[#efeee9]">
          {picture && failedImage !== picture ? (
            <img src={picture} alt={product.name} loading="lazy" decoding="async" onError={() => setFailedImage(picture)} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-600"><ImageOff aria-hidden="true" className="h-8 w-8" /><span className="text-xs">{t('product.imageUnavailable')}</span></div>
          )}
          {product.hasLowStock && <span className="absolute left-2 top-3 max-w-[55%] bg-white px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-900">{t('shop.lowStock')}</span>}
          <span className="absolute bottom-3 left-3 right-3 hidden items-center justify-between bg-white/95 p-3 text-[10px] font-medium uppercase tracking-widest text-neutral-900 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex" aria-hidden="true">{t('shop.viewProduct')}<ArrowUpRight className="h-4 w-4" /></span>
        </div>
        <div className="flex items-start justify-between gap-2 border-b border-neutral-200 pb-4 pt-4">
          <div className="min-w-0"><Heading className="text-sm font-medium leading-relaxed text-neutral-900">{product.name}</Heading><p className="mt-1 text-xs text-neutral-600">{formatPrice(product.price)}</p></div>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
        </div>
      </Link>
      <WishlistButton productId={product.id} />
      <CompareButton productId={product.id} />
    </article>
  );
}
