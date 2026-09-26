import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductImage } from '@/components/common/ProductImage';
import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import type { Product } from '@/lib/types';

export function CompleteLook({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [result, setResult] = useState<{ productId: string; products: Product[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get<Product[]>(`/products/${productId}/complete-look`, { signal: controller.signal })
      .then(products => { if (!controller.signal.aborted) setResult({ productId, products }); })
      .catch(() => { if (!controller.signal.aborted) setResult(null); });
    return () => controller.abort();
  }, [productId]);

  // Recommendations have their own variants and prices. Let shoppers choose
  // those options on the product page before any cart mutation.
  if (result?.productId !== productId || result.products.length === 0) return null;

  return (
    <section aria-label={t('completeLook.title')} className="mt-24 border-t border-neutral-100 pt-16">
      <h2 className="font-display text-2xl font-light tracking-tight text-neutral-900 md:text-3xl">
        {t('completeLook.title')}
      </h2>
      <div className="mt-2 h-px w-12 bg-[#a07a52]" />
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">{t('completeLook.description')}</p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
        {result.products.map(product => {
          const picture = product.picture || product.images?.[0];
          return (
            <article key={product.id} className="group min-w-0">
              <Link to={`/products/${product.id}`} className="block">
                <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                  <ProductImage src={picture} alt={product.name} width={600} height={800}
                    className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" />
                </div>
                <h3 className="mt-4 break-words text-sm font-medium text-neutral-900">{product.name}</h3>
                <p className="mt-1 text-sm text-neutral-600">{formatPrice(product.price)}</p>
              </Link>
              <Link to={`/products/${product.id}`} aria-label={t('completeLook.chooseOptionsFor', { name: product.name })}
                className="mt-3 flex min-h-11 items-center justify-between gap-2 border border-neutral-200 px-3 py-2.5 text-xs font-medium tracking-wide text-neutral-800 hover:border-neutral-900 hover:bg-neutral-100">
                {t('completeLook.chooseOptions')}<ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
