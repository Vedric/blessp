import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function Pagination({ page, totalPages, onChange, label }: { label?: string; page: number; totalPages: number; onChange: (page: number) => void }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  return <nav aria-label={label ?? t('common.pagination')} className="mt-12 flex flex-wrap items-center justify-center gap-1">
    {pages.map((value, index) => <span key={value} className="flex items-center gap-1">
      {index > 0 && value > pages[index - 1] + 1 && <span aria-hidden="true" className="px-1 text-neutral-500">…</span>}
      <button onClick={() => onChange(value)} aria-label={t('shop.pageNumber', { page: value })} aria-current={value === page ? 'page' : undefined} className={cn('flex h-11 min-w-11 items-center justify-center px-2 text-sm tabular-nums', value === page ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100')}>{value}</button>
    </span>)}
  </nav>;
}
