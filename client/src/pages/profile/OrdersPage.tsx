import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, ChevronRight, ArrowLeft, ShoppingBag, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { formatDate, cn } from '@/lib/utils';
import type { Order, PaginatedResponse } from '@/lib/types';

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  shipped: { label: 'Shipped', className: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-400' },
  delivered: { label: 'Delivered', className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-50 text-neutral-500 border-neutral-200', dot: 'bg-neutral-400' },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function OrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const res = await api.getRaw<PaginatedResponse<Order>>(
          `/orders?page=${page}&perPage=10`,
        );
        setOrders(res.data);
        setTotalPages(res.pagination.totalPages);
      } catch {
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [page]);

  return (
    <div className="min-h-screen px-4 pt-8 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/profile"
            className="mb-6 inline-flex items-center gap-1 text-xs font-medium tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('profile.account')}
          </Link>

          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('orders.myOrders')}
          </h1>
          <div className="mt-2 h-px w-12 bg-[#c8a97e]" />

          {isLoading ? (
            <div className="mt-10 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse border border-neutral-100 p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-24 rounded bg-neutral-100" />
                    <div className="h-5 w-20 rounded bg-neutral-100" />
                  </div>
                  <div className="mt-3 flex gap-4">
                    <div className="h-3 w-28 rounded bg-neutral-100" />
                    <div className="h-3 w-16 rounded bg-neutral-100" />
                    <div className="h-3 w-20 rounded bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-16 flex flex-col items-center rounded-lg border border-neutral-100 bg-neutral-50/50 px-8 py-20 text-center"
            >
              <div className="relative">
                <Package className="h-16 w-16 text-neutral-200" />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#c8a97e]/10"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#c8a97e]" />
                </motion.div>
              </div>
              <h3 className="font-display mt-6 text-xl font-light text-neutral-900">
                {t('orders.noOrders')}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">
                {t('orders.noOrdersDesc')}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center gap-2 bg-neutral-900 px-8 py-3.5 text-sm font-medium tracking-widest text-white uppercase transition-all hover:bg-[#c8a97e] hover:text-neutral-950"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {t('orders.browseCollection')}
                </Link>
                <Link
                  to="/wishlist"
                  className="inline-flex items-center justify-center gap-2 border border-neutral-200 px-8 py-3.5 text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:border-neutral-900"
                >
                  {t('orders.viewWishlist')}
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="mt-10 space-y-4"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              {orders.map((order) => {
                const status = statusConfig[order.status] || statusConfig.pending;
                return (
                  <motion.div key={order.id} variants={fadeUp}>
                    <Link
                      to={`/profile/orders/${order.id}`}
                      className="group flex items-center justify-between border border-neutral-100 p-6 transition-all hover:border-neutral-200 hover:bg-neutral-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-neutral-900">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                              status.className,
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
                          <span>{formatDate(order.createdAt)}</span>
                          <span>{t('orders.itemCount', { count: order.items.length })}</span>
                          <span className="font-medium text-neutral-900">
                            {formatPrice(order.totalCents)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-300 transition-colors group-hover:text-neutral-600" />
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center text-sm transition-colors',
                    page === i + 1
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
