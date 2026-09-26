import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { Pagination } from '@/components/common/Pagination';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import type { ProductVariant } from '@/lib/types';

type Row = ProductVariant & { product: { id: string; name: string; isActive: boolean; sizes: string[]; colors: string[] } };
type Pages = { page: number; perPage: number; totalItems: number; totalPages: number };
type Inventory = { items: Row[]; available: number; unconfiguredProducts: number; pagination: Pages };
type History = { items: { id: string; before: number; after: number; reason: string; note: string | null; createdAt: string; actor: { firstName: string; lastName: string } | null }[]; pagination: Pages };
const inputClass = 'mt-2 min-h-11 w-full border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900';

export default function AdminInventoryPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [mode, setMode] = useState<'adjust' | 'history'>('adjust');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [dialogError, setDialogError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const panel = useRef<HTMLDialogElement>(null);
  useDialogFocus(!!selected, panel, () => { if (!submitting.current) setSelected(null); });

  useEffect(() => {
    if (selected && panel.current && !panel.current.open) panel.current.showModal();
  }, [selected]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: search.trim(), status, page: String(page), perPage: '25' });
      api.get<Inventory>(`/admin/inventory?${params}`, { signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) setData(result); })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, status, page, attempt]);

  useEffect(() => {
    if (!selected || mode !== 'history') return;
    const controller = new AbortController();
    setHistoryLoading(true); setDialogError(''); setHistory(null);
    api.get<History>(`/admin/inventory/${selected.id}/history?page=${historyPage}&perPage=10`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setHistory(result); })
      .catch(() => { if (!controller.signal.aborted) setDialogError(t('inventory.failedLoad')); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [selected, mode, historyPage, historyAttempt, t]);

  const open = (row: Row, nextMode: 'adjust' | 'history') => {
    setSelected(row); setMode(nextMode); setQuantity(String(row.stock)); setReason('restock'); setNote('');
    setDialogError(''); setConflict(false); setHistory(null); setHistoryPage(1); request.current = null;
  };
  const refreshStock = async () => {
    if (!selected || submitting.current) return;
    submitting.current = true; setSaving(true);
    try {
      const variants = await api.get<ProductVariant[]>(`/admin/products/${selected.productId}/variants`);
      const current = variants.find(variant => variant.id === selected.id);
      if (!current) throw new Error('Missing variant');
      setSelected({ ...selected, ...current }); setQuantity(String(current.stock)); setConflict(false); setDialogError(''); request.current = null;
      setAttempt(value => value + 1);
    } catch { setDialogError(t('inventory.failedLoad')); }
    finally { submitting.current = false; setSaving(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || submitting.current || conflict) return;
    const stock = Number(quantity);
    if (!quantity.trim() || !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000 || stock === selected.stock) return;
    submitting.current = true; setSaving(true); setDialogError('');
    const body = { expectedStock: selected.stock, stock, reason, note: note.trim() };
    const signature = JSON.stringify({ id: selected.id, ...body });
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try {
      await api.post(`/admin/inventory/${selected.id}/adjustments`, { ...body, requestId: request.current.id });
      setNotice(t('inventory.saved')); setSelected(null); setAttempt(value => value + 1);
    } catch (err) {
      const stale = (err as { code?: string }).code === 'CONFLICT';
      setConflict(stale); setDialogError(t(stale ? 'inventory.conflict' : 'inventory.failedSave'));
    } finally { submitting.current = false; setSaving(false); }
  };

  return <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <Breadcrumbs items={[{ label: t('nav.admin'), href: '/admin' }, { label: t('inventory.title') }]} />
    <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="font-display text-3xl text-neutral-900">{t('inventory.title')}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">{t('inventory.description')}</p></div>
      <Link to="/admin/products" className="inline-flex min-h-11 items-center underline underline-offset-4">{t('admin.products.title')}</Link>
    </div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      <div className="border border-neutral-200 bg-[#f3f1eb] p-5"><p className="text-sm text-neutral-600">{t('inventory.matches')}</p><p className="mt-2 text-3xl tabular-nums">{data?.pagination.totalItems ?? t('common.notAvailable')}</p></div>
      <div className="border border-neutral-200 bg-[#f3f1eb] p-5"><p className="text-sm text-neutral-600">{t('inventory.availableTotal')}</p><p className="mt-2 text-3xl tabular-nums">{data?.available ?? t('common.notAvailable')}</p></div>
      <div className="border border-neutral-200 p-5"><Package className="h-5 w-5" aria-hidden="true" /><p className="mt-3 text-sm text-neutral-600">{t('inventory.lowHelp')}</p></div>
    </div>
    {!!data?.unconfiguredProducts && <p className="mt-5 border-l-2 border-amber-700 bg-amber-50 p-4 text-sm text-amber-900">{t('inventory.unconfigured', { count: data.unconfiguredProducts })} <Link className="underline" to="/admin/products">{t('admin.products.title')}</Link></p>}
    <div className="mt-8 flex flex-wrap items-end gap-4">
      <label className="min-w-0 basis-full text-sm text-neutral-700 sm:flex-1 sm:basis-0" htmlFor="inventory-search">{t('inventory.search')}<input id="inventory-search" value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setPage(1); setNotice(''); }} className={inputClass} type="search" /></label>
      <label className="min-w-0 flex-1 text-sm text-neutral-700 sm:flex-none" htmlFor="inventory-status">{t('inventory.status')}<select id="inventory-status" className={inputClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); setNotice(''); }}>{['all', 'low', 'out', 'available'].map(value => <option key={value} value={value}>{t(`inventory.states.${value}`)}</option>)}</select></label>
      <button onClick={() => setAttempt(value => value + 1)} aria-label={t('inventory.refresh')} className="flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-300"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
    </div>
    {notice && <p role="status" className="mt-5 text-sm text-green-800">{notice}</p>}
    {error && <div role="alert" className="mt-5 text-sm text-red-800">{t('inventory.failedLoad')} <button className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>{t('common.retry')}</button></div>}
    <div className="mt-6 space-y-3" aria-busy={loading}>
      {loading && <p role="status" className="text-sm text-neutral-600">{t('common.loading')}</p>}
      {!loading && !error && data?.items.length === 0 && <p className="border border-neutral-200 p-6">{t('inventory.empty')}</p>}
      {data?.items.map(row => {
        const selectable = (row.product.sizes.length ? row.product.sizes : ['']).includes(row.size) && (row.product.colors.length ? row.product.colors : ['']).includes(row.color);
        return <article key={row.id} className="grid min-w-0 gap-4 border border-neutral-200 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
          <div className="min-w-0"><h2 className="break-words font-medium text-neutral-900"><Link to={`/admin/products/${row.productId}/edit`} className="underline underline-offset-4">{row.product.name}</Link></h2><p className="mt-2 break-words text-sm text-neutral-600">{row.size || t('common.notAvailable')} / {row.color || t('common.notAvailable')} · SKU : {row.sku || t('common.notAvailable')}</p>{(!row.product.isActive || !selectable) && <p className="mt-2 text-xs text-amber-800">{t('inventory.notOffered')}</p>}</div>
          <div className="flex flex-wrap items-center gap-4"><div className="min-w-20"><p className="text-2xl font-medium tabular-nums text-neutral-900">{row.stock}</p><p className={`text-xs ${row.stock === 0 ? 'text-red-800' : row.stock <= 5 ? 'text-amber-800' : 'text-neutral-600'}`}>{t(`inventory.states.${row.stock === 0 ? 'out' : row.stock <= 5 ? 'low' : 'available'}`)}</p></div><button disabled={loading} onClick={() => open(row, 'adjust')} className="min-h-11 border border-neutral-900 bg-neutral-900 px-4 text-sm text-white disabled:opacity-50">{t('inventory.adjust')}</button><button disabled={loading} onClick={() => open(row, 'history')} className="min-h-11 px-2 text-sm underline underline-offset-4 disabled:opacity-50">{t('inventory.history')}</button></div>
        </article>;
      })}
    </div>
    {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}
    {selected && <dialog ref={panel} aria-modal="true" aria-labelledby="inventory-dialog-title" tabIndex={-1} className="fixed inset-0 m-auto max-h-[90svh] w-[calc(100%-24px)] max-w-xl overflow-y-auto border-0 bg-white p-5 text-neutral-900 backdrop:bg-black/60 sm:p-8">
        <div className="flex items-start justify-between gap-3"><h2 id="inventory-dialog-title" className="font-display text-2xl">{t(mode === 'adjust' ? 'inventory.adjust' : 'inventory.history')}</h2><button disabled={saving} onClick={() => setSelected(null)} aria-label={t('common.close')} className="flex h-11 w-11 shrink-0 items-center justify-center"><X className="h-5 w-5" aria-hidden="true" /></button></div>
        <p className="mt-3 break-words text-sm text-neutral-600">{selected.product.name} · {selected.size || t('common.notAvailable')} / {selected.color || t('common.notAvailable')}</p>
        {dialogError && <p role="alert" className="mt-5 text-sm text-red-800">{dialogError}</p>}
        {mode === 'adjust' ? <form onSubmit={save} className="mt-6 space-y-5">
          <p className="text-sm">{t('inventory.current')} : <strong>{selected.stock}</strong></p>
          <label className="block text-sm" htmlFor="inventory-quantity">{t('inventory.newQuantity')}<input id="inventory-quantity" required type="number" min="0" max="1000000" step="1" className={inputClass} value={quantity} disabled={saving || conflict} onChange={event => setQuantity(event.target.value)} /></label>
          <label className="block text-sm" htmlFor="inventory-reason">{t('inventory.reason')}<select id="inventory-reason" required className={inputClass} value={reason} disabled={saving} onChange={event => setReason(event.target.value)}>{['restock', 'count', 'damage', 'return', 'correction'].map(value => <option key={value} value={value}>{t(`inventory.reasons.${value}`)}</option>)}</select></label>
          <label className="block text-sm" htmlFor="inventory-note">{t('inventory.note')}<textarea id="inventory-note" rows={3} maxLength={500} className={inputClass} value={note} disabled={saving} onChange={event => setNote(event.target.value)} /></label>
          <p className="text-xs leading-relaxed text-neutral-600">{t('inventory.adjustHelp')}</p>
          {conflict ? <button type="button" disabled={saving} onClick={() => void refreshStock()} className="min-h-11 w-full bg-neutral-900 px-5 py-3 text-sm text-white disabled:opacity-50">{t('inventory.reloadStock')}</button> : <button disabled={saving || !quantity.trim() || Number(quantity) === selected.stock} className="min-h-11 w-full bg-neutral-900 px-5 py-3 text-sm text-white disabled:opacity-50">{t(saving ? 'common.loading' : 'inventory.save')}</button>}
        </form> : <div className="mt-5" aria-busy={historyLoading}>
          <p className="text-xs leading-relaxed text-neutral-600">{t('inventory.historyHelp')}</p>
          {historyLoading && <p className="mt-4">{t('common.loading')}</p>}
          {dialogError && <button onClick={() => setHistoryAttempt(value => value + 1)} className="min-h-11 underline">{t('common.retry')}</button>}
          {history?.items.length === 0 && <p className="mt-5 text-sm">{t('inventory.noHistory')}</p>}
          <ol className="mt-4 divide-y divide-neutral-200">{history?.items.map(item => <li key={item.id} className="py-4 text-sm"><p className="font-medium">{item.before} → {item.after} · {t(`inventory.reasons.${item.reason}`)}</p><p className="mt-1 text-xs text-neutral-600">{new Date(item.createdAt).toLocaleString(i18n.resolvedLanguage)} · {item.actor ? `${item.actor.firstName} ${item.actor.lastName}` : t('inventory.deletedActor')}</p>{item.note && <p className="mt-2 whitespace-pre-wrap break-words text-neutral-700">{item.note}</p>}</li>)}</ol>
          {history && <Pagination page={historyPage} totalPages={history.pagination.totalPages} onChange={setHistoryPage} />}
        </div>}
    </dialog>}
  </div>;
}
