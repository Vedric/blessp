import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, MapPin, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { formatDate, cn } from '@/lib/utils';
import { OrderTimeline } from '@/components/order/OrderTimeline';
import type { Order } from '@/lib/types';

const statusStyles: Record<string, { className: string; dot: string }> = {
  pending: { className: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
  confirmed: { className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  processing: { className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  shipped: { className: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-400' },
  delivered: { className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  cancelled: { className: 'bg-neutral-50 text-neutral-500 border-neutral-200', dot: 'bg-neutral-400' },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const data = await api.get<Order>(`/orders/${id}`);
        setOrder(data);
      } catch {
        setOrder(null);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen px-4 pt-8 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse space-y-6">
            <div className="h-4 w-48 rounded bg-neutral-100" />
            <div className="h-8 w-1/3 rounded bg-neutral-100" />
            <div className="h-48 rounded bg-neutral-100" />
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="h-36 rounded bg-neutral-100" />
              <div className="h-36 rounded bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-neutral-200" />
        <p className="text-neutral-500">{t('orderDetail.notFound')}</p>
        <Link
          to="/profile/orders"
          className="text-sm font-medium text-[#c8a97e] underline underline-offset-4 transition-colors hover:text-neutral-900"
        >
          {t('orderDetail.backToOrders')}
        </Link>
      </div>
    );
  }

  const status = statusStyles[order.status] || statusStyles.pending;
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
  const shipping = order.totalCents - subtotal;
  const orderRef = order.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen px-4 pt-8 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Breadcrumbs */}
        <div className="mb-8">
          <Breadcrumbs
            items={[
              { label: t('common.home'), href: '/' },
              { label: t('nav.orders'), href: '/profile/orders' },
              { label: `#${orderRef}` },
            ]}
          />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          {/* Order header */}
          <motion.div
            className="flex flex-wrap items-start justify-between gap-4"
            variants={fadeUp}
          >
            <div>
              <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
                Order #{orderRef}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {t('orderDetail.placedOn', { date: formatDate(order.createdAt) })}
              </p>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium uppercase tracking-wide',
                status.className,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
              {t(`orders.status.${order.status}`)}
            </span>
          </motion.div>

          <motion.div className="mt-2 h-px w-12 bg-[#c8a97e]" variants={fadeUp} />

          {/* Items */}
          <motion.div className="mt-10 border border-neutral-100" variants={fadeUp}>
            <div className="flex items-center gap-2 border-b border-neutral-100 px-6 py-4">
              <Package className="h-4 w-4 text-neutral-400" />
              <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                {t('orderDetail.items', { count: order.items.length })}
              </h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 px-6 py-5">
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center bg-neutral-50">
                    <Package className="h-6 w-6 text-neutral-200" />
                  </div>
                  <div className="flex flex-1 items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {item.productName}
                      </p>
                      {(item.size || item.color) && (
                        <p className="mt-1 text-sm text-neutral-500">
                          {[item.size, item.color].filter(Boolean).join(' / ')}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-neutral-400">
                        {t('orderDetail.qty', { count: item.quantity })}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-neutral-900">
                      {formatPrice(item.unitPriceCents * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Order Timeline */}
          <motion.div className="mt-6" variants={fadeUp}>
            <OrderTimeline orderId={order.id} currentStatus={order.status} />
          </motion.div>

          {/* Two-column layout for address and totals */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {/* Shipping address */}
            <motion.div className="border border-neutral-100 p-6" variants={fadeUp}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-neutral-400" />
                <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                  {t('checkout.shippingAddress')}
                </h2>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-neutral-600">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                <br />
                {order.shippingAddress.addressLine1}
                {order.shippingAddress.addressLine2 && (
                  <>
                    <br />
                    {order.shippingAddress.addressLine2}
                  </>
                )}
                <br />
                {order.shippingAddress.city}{order.shippingAddress.province ? `, ${order.shippingAddress.province}` : ''}{' '}
                {order.shippingAddress.postalCode}
                <br />
                {order.shippingAddress.country}
              </p>
            </motion.div>

            {/* Order totals */}
            <motion.div className="border border-neutral-100 p-6" variants={fadeUp}>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-neutral-400" />
                <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                  {t('checkout.orderSummary')}
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">{t('common.subtotal')}</span>
                  <span className="text-neutral-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">{t('common.shipping')}</span>
                  <span className={cn(
                    'text-neutral-900',
                    shipping <= 0 && 'text-green-600',
                  )}>
                    {shipping <= 0 ? t('common.free') : formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-neutral-100 pt-3 text-sm font-medium">
                  <span className="text-neutral-900">{t('common.total')}</span>
                  <span className="text-neutral-900">
                    {formatPrice(order.totalCents)}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Help link */}
          <motion.div className="mt-8 text-center" variants={fadeUp}>
            <p className="text-sm text-neutral-400">
              {t('orderDetail.needHelp')}{' '}
              <Link
                to="/contact"
                className="text-[#c8a97e] underline underline-offset-4 transition-colors hover:text-neutral-900"
              >
                {t('orderDetail.contactUs')}
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
