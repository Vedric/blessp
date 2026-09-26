import { useId, useRef, useState } from 'react';
import { ProductImage } from '@/components/common/ProductImage';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { cn } from '@/lib/utils';

export function ProductGallery({ name, images }: { name: string; images: string[] }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(open, panel, () => { setOpen(false); setZoomed(false); });
  const select = (index: number) => { setSelected((index + images.length) % images.length); setZoomed(false); viewport.current?.scrollTo(0, 0); };
  if (!images.length) return <div className="flex aspect-[3/4] items-center justify-center gap-3 bg-neutral-100 text-neutral-600"><ImageOff aria-hidden="true" />{t('product.imageUnavailable')}</div>;
  return <>
    <button onClick={() => { setZoomed(false); setOpen(true); }} aria-label={t('gallery.open', { name })} className="group relative block aspect-[3/4] w-full overflow-hidden bg-[#efeee9] text-left">
      <ProductImage src={images[selected]} alt={name} loading="eager" className="h-full w-full object-cover" />
      <span className="absolute bottom-4 right-4 flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-neutral-900 shadow-sm"><ZoomIn className="h-4 w-4" aria-hidden="true" />{t('gallery.enlarge')}</span>
    </button>
    {images.length > 1 && <div className="mt-4 flex flex-wrap gap-2" aria-label={t('gallery.views')}>
      {images.map((src, index) => <button key={`${src}-${index}`} onClick={() => select(index)} aria-label={t('gallery.view', { number: index + 1 })} aria-pressed={selected === index} className={cn('h-16 w-16 overflow-hidden border-2 sm:h-20 sm:w-20', selected === index ? 'border-neutral-900' : 'border-transparent hover:border-neutral-400')}><ProductImage src={src} alt="" className="h-full w-full object-cover" /></button>)}
    </div>}
    {open && createPortal(
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-2 sm:p-6" onClick={() => setOpen(false)}>
        <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex max-h-[95svh] w-full max-w-6xl flex-col overflow-hidden bg-[#f7f5ef] shadow-2xl" onClick={event => event.stopPropagation()} onKeyDown={event => {
          if (zoomed && event.target === viewport.current) return;
          if (event.key === 'ArrowLeft') { event.preventDefault(); select(selected - 1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); select(selected + 1); }
        }}>
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 sm:px-6">
            <h2 id={titleId} className="min-w-0 text-sm font-medium text-neutral-900">{name}</h2>
            <button onClick={() => { setOpen(false); setZoomed(false); }} aria-label={t('gallery.close')} className="flex h-11 w-11 shrink-0 items-center justify-center"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
          <div ref={viewport} role={zoomed ? 'region' : undefined} className="min-h-0 flex-1 overflow-auto bg-white" tabIndex={zoomed ? 0 : undefined} aria-label={zoomed ? t('gallery.pan') : undefined}>
            <ProductImage src={images[selected]} alt={t('gallery.imageAlt', { name, number: selected + 1 })} loading="eager" className={zoomed ? 'mx-auto w-[160%] max-w-none' : 'mx-auto h-[65svh] max-h-[720px] w-full object-contain'} />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-3 py-3 sm:px-6">
            <button onClick={() => setZoomed(value => !value)} aria-pressed={zoomed} className="flex min-h-11 items-center gap-2 px-2 text-xs text-neutral-900">{zoomed ? <ZoomOut className="h-4 w-4" aria-hidden="true" /> : <ZoomIn className="h-4 w-4" aria-hidden="true" />}{zoomed ? t('gallery.zoomOut') : t('gallery.zoomIn')}</button>
            <div className="flex items-center gap-2"><button disabled={images.length < 2} onClick={() => select(selected - 1)} aria-label={t('gallery.previous')} className="flex h-11 w-11 items-center justify-center disabled:opacity-40"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button><span role="status" className="min-w-10 text-center text-xs tabular-nums">{selected + 1} / {images.length}</span><button disabled={images.length < 2} onClick={() => select(selected + 1)} aria-label={t('gallery.next')} className="flex h-11 w-11 items-center justify-center disabled:opacity-40"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button></div>
          </div>
        </div>
      </div>, document.body)}
  </>;
}
