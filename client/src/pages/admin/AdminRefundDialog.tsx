import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import type { Order } from '@/lib/types';

export function AdminRefundDialog({ order, onClose, onRequested }: { order: Order; onClose: () => void; onRequested: () => void }) {
  const { t } = useTranslation();
  const panel = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const requestBody = useRef<{ orderId: string; expectedRefundedCents: number; reason?: string } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  useDialogFocus(true, panel, () => { if (!sending.current) onClose(); });
  useEffect(() => { if (panel.current && !panel.current.open) panel.current.showModal(); }, []);
  const remaining = order.totalCents - order.refundedCents;
  const submit = async () => {
    if (sending.current || remaining <= 0 || needsRefresh) return;
    sending.current = true; setBusy(true); setError('');
    // Preserve the provider idempotency parameters if a response is lost.
    requestBody.current ??= { orderId: order.id, expectedRefundedCents: order.refundedCents, reason: reason.trim() || undefined };
    setAttempted(true);
    try {
      await api.post('/payments/refund', requestBody.current);
      onRequested();
    } catch (err) {
      setNeedsRefresh((err as { code?: string }).code === 'CONFLICT');
      setError(t('refund.failed'));
    } finally { sending.current = false; setBusy(false); }
  };
  return <dialog ref={panel} aria-labelledby="refund-dialog-title" className="fixed inset-0 m-auto max-h-[90svh] w-[calc(100%-24px)] max-w-lg overflow-y-auto border-0 bg-white p-5 text-neutral-900 backdrop:bg-black/60 sm:p-8">
    <div className="flex items-start justify-between gap-3"><h2 id="refund-dialog-title" className="font-display text-2xl">{t('refund.title')}</h2><button disabled={busy} onClick={onClose} aria-label={t('common.close')} className="flex h-11 w-11 shrink-0 items-center justify-center"><X aria-hidden="true" className="h-5 w-5" /></button></div>
    <p className="mt-3 break-words text-sm text-neutral-600">{order.orderNumber ?? order.id}</p>
    <p className="mt-4 text-sm leading-relaxed">{t('refund.description')}</p>
    <p className="mt-5 text-lg font-medium">{t('refund.amount')} : {formatPrice(remaining)} CAD</p>
    <form className="mt-5" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor="refund-reason" className="block text-sm">{t('refund.reason')}</label>
      <textarea id="refund-reason" rows={3} maxLength={500} disabled={busy || attempted} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full border border-neutral-300 p-3 text-sm" />
      <p className="mt-3 text-xs leading-relaxed text-neutral-600">{t('refund.stock')}</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
      {needsRefresh ? <button type="button" onClick={onClose} className="mt-5 min-h-11 w-full border border-neutral-900 px-4">{t('common.close')}</button> : <button disabled={busy || remaining <= 0} className="mt-5 min-h-11 w-full bg-neutral-900 px-4 py-3 text-sm text-white disabled:opacity-50">{t(busy ? 'common.loading' : 'refund.confirm')}</button>}
    </form>
  </dialog>;
}
