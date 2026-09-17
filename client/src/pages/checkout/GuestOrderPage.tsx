import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { cn } from '@/lib/utils';

interface GuestOrder { orderNumber: string; status: string; paymentStatus: string; totalCents: number; refundedCents: number; items: { id: string; productName: string; quantity: number }[] }
const steps = ['pending', 'paid', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function GuestOrderPage() {
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(false); setOrder(null);
    try { setOrder(await api.post('/orders/guest/lookup', { orderNumber: orderNumber.trim(), email: email.trim() })); }
    catch { setError(true); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const currentStep = order ? steps.indexOf(order.status) : -1;
  return <div className="min-h-screen bg-[#fcfbf8]">
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('footer.trackOrder') }]} />
      <div className="mt-10 grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div><p className="editorial-eyebrow">BLE$$ P / {t('footer.customerCare')}</p><h1 className="editorial-title mt-4">{t('guestOrder.title')}</h1><p className="mt-6 max-w-sm text-sm leading-relaxed text-neutral-600">{t('guestOrder.intro')}</p><p className="mt-6 flex items-start gap-3 text-xs leading-relaxed text-neutral-600"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{t('guestOrder.private')}</p><Link to="/profile/orders" className="editorial-link mt-8">{t('guestOrder.memberOrders')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
        <div className="border border-neutral-200 bg-white p-6 sm:p-8">
          <Package className="h-7 w-7 text-[#80603c]" aria-hidden="true" />
          <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
            <label className="block text-sm text-neutral-700" htmlFor="guest-order-number">{t('guestOrder.number')}<input id="guest-order-number" className="mt-2 min-h-12 w-full border border-neutral-300 bg-[#fcfbf8] px-3 text-neutral-900" required maxLength={100} autoCapitalize="characters" value={orderNumber} onChange={event => setOrderNumber(event.target.value)} /></label>
            <label className="block text-sm text-neutral-700" htmlFor="guest-order-email">{t('common.email')}<input id="guest-order-email" className="mt-2 min-h-12 w-full border border-neutral-300 bg-[#fcfbf8] px-3 text-neutral-900" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
            <button disabled={busy} className="flex min-h-12 w-full items-center justify-between gap-4 bg-neutral-900 px-5 py-3 text-sm text-white disabled:opacity-60">{busy ? t('common.loading') : t('guestOrder.submit')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </form>
          {error && <p role="alert" className="mt-5 border-l-2 border-red-700 pl-4 text-sm leading-relaxed text-red-800">{t('guestOrder.notFound')}</p>}
        </div>
      </div>
      {order && <section aria-live="polite" className="mt-10 border border-neutral-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="editorial-eyebrow">{t('guestOrder.number')}</p><h2 className="mt-2 break-all font-display text-2xl text-neutral-900">{order.orderNumber}</h2></div><div className="space-y-2 text-right text-sm"><p className="font-medium">{t(`orders.status.${order.status}`, { defaultValue: order.status })}</p><p className="text-neutral-600">{t(`orders.paymentStatus.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}</p></div></div>
        {currentStep >= 0 && <ol aria-label={t('orderTimeline.title')} className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{steps.map((step, index) => <li key={step} aria-current={index === currentStep ? 'step' : undefined} className={cn('border-t-2 pt-3 text-xs', index <= currentStep ? 'border-[#80603c] text-neutral-900' : 'border-neutral-200 text-neutral-600')}><span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100">{index < currentStep ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}</span>{t(`orders.status.${step}`)}</li>)}</ol>}
        <ul className="mt-8 divide-y divide-neutral-100 border-y border-neutral-200">{order.items.map(item => <li key={item.id} className="flex gap-4 py-4 text-sm"><span className="text-neutral-600">{item.quantity} ×</span><span>{item.productName}</span></li>)}</ul>
        <dl className="ml-auto mt-5 max-w-xs space-y-2 text-sm"><div className="flex justify-between gap-4"><dt>{t('common.total')}</dt><dd className="font-medium">{formatPrice(order.totalCents)}</dd></div>{order.refundedCents > 0 && <div className="flex justify-between gap-4"><dt>{t('orders.status.refunded')}</dt><dd>{formatPrice(order.refundedCents)}</dd></div>}</dl>
        <Link to="/contact" className="editorial-link mt-6">{t('guestOrder.help')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>}
    </div>
  </div>;
}
