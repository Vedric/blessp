import { useEffect } from 'react';
import { setMeta, setPageMetadata, SITE_TITLE } from '@/lib/metadata';

interface DocumentMetaOptions {
  title?: string;
  description?: string;
  image?: string;
  price?: number;
  pending?: boolean;
  noIndex?: boolean;
}

/** Keep title, description and sharing metadata in sync after SPA navigation. */
export function useDocumentMeta({ title, description, image, price, pending, noIndex }: DocumentMetaOptions): void {
  useEffect(() => {
    if (pending) return;
    const fullTitle = title ? (title.includes('BLE$$') ? title : `${title} — BLE$$ P`) : SITE_TITLE;
    setPageMetadata(fullTitle, description, image, price);
    if (noIndex) setMeta('robots', 'noindex, follow');
    return () => setPageMetadata();
  }, [title, description, image, price, pending, noIndex]);
}
