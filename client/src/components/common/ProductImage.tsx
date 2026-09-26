import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  width?: number;
  height?: number;
  compact?: boolean;
}

export function ProductImage({ src, alt, className, loading = 'lazy', width, height, compact = false }: ProductImageProps) {
  const { t } = useTranslation();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) return (
    <div role="img" aria-label={alt ? `${alt}: ${t('product.imageUnavailable')}` : undefined} aria-hidden={!alt || undefined} className={`flex flex-col items-center justify-center gap-3 bg-neutral-100 px-3 text-center text-neutral-600 ${className ?? ''}`}>
      <ImageOff aria-hidden="true" className={compact ? 'h-5 w-5 shrink-0' : 'h-8 w-8 shrink-0'} />
      {alt && !compact && <span className="text-xs [overflow-wrap:anywhere]">{t('product.imageUnavailable')}</span>}
    </div>
  );
  return <img src={src} alt={alt} className={className} loading={loading} decoding="async" width={width} height={height} onError={() => setFailedSource(src)} />;
}
