import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import type { Order, PaginatedResponse } from '@/lib/types';

const statusOptions = [
  'all',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

const updateStatuses = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export default function AdminOrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '15');
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await api.getRaw<PaginatedResponse<Order>>(
        `/admin/orders?${params.toString()}`,
      );
      setOrders(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/admin/orders/${orderId}`, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o,
        ),
      );
    } catch {
      // Silently handle
    }
  };

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6">
            <Breadcrumbs
              items={[
                { label: t('common.home'), href: '/' },
                { label: t('nav.admin'), href: '/admin' },
                { label: t('admin.orders.title') },
              ]}
            />
          </div>

          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('admin.orders.title')}
          </h1>
          <div className="mt-2 h-px w-12 bg-brand-500" />

          {/* Status filter */}
          <div className="mt-8 flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={cn(
                  'px-4 py-2 text-xs font-medium tracking-widest uppercase transition-colors',
                  statusFilter === status
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100',
                )}
              >
                {status === 'all' ? t('admin.orders.allStatuses') : t(`orders.status.${status}`)}
              </button>
            ))}
          </div>

          {/* Orders list */}
          {isLoading ? (
            <div className="mt-8 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse border border-neutral-100 p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-4 w-24 bg-neutral-100" />
                    <div className="h-4 w-16 bg-neutral-100" />
                    <div className="flex-1" />
                    <div className="h-4 w-20 bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-20 text-center">
              <p className="text-neutral-500">{t('admin.orders.noOrders')}</p>
            </div>
          ) : (
            <div className="mt-8 space-y-2">
              {orders.map((order) => {
                const statusClass = statusStyles[order.status] || statusStyles.pending;
                const isExpanded = expandedOrder === order.id;

                return (
                  <div
                    key={order.id}
                    className="border border-neutral-100"
                  >
                    <button
                      onClick={() =>
                        setExpandedOrder(isExpanded ? null : order.id)
                      }
                      className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-neutral-50"
                    >
                      <span className="font-mono text-sm font-medium text-neutral-900">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          'border px-2.5 py-0.5 text-2xs font-medium uppercase',
                          statusClass,
                        )}
                      >
                        {t(`orders.status.${order.status}`)}
                      </span>
                      <span className="text-sm text-neutral-500">
                        {formatDate(order.createdAt)}
                      </span>
                      <span className="text-sm text-neutral-500">
                        {t('admin.orders.itemCount', { count: order.items.length })}
                      </span>
                      <span className="ml-auto text-sm font-medium text-neutral-900">
                        {formatPrice(order.totalCents)}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-neutral-400 transition-transform',
                          isExpanded && 'rotate-180',
                        )}
                      />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-neutral-50 px-5 py-4">
                        {/* Items */}
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 text-sm"
                            >
                              <div className="h-10 w-10 flex-shrink-0 bg-neutral-50">
                              </div>
                              <span className="flex-1 text-neutral-700">
                                {item.productName}
                                {item.size ? ` (${item.size})` : ''}
                                {item.color ? ` (${item.color})` : ''}
                              </span>
                              <span className="text-neutral-500">
                                &times;{item.quantity}
                              </span>
                              <span className="font-medium text-neutral-900">
                                {formatPrice(item.unitPriceCents * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Shipping */}
                        <div className="mt-4 text-sm text-neutral-500">
                          <span className="font-medium text-neutral-700">
                            {t('admin.orders.shipTo')}
                          </span>{' '}
                          {order.shippingAddress.firstName} {order.shippingAddress.lastName},{' '}
                          {order.shippingAddress.addressLine1},{' '}
                          {order.shippingAddress.city},{' '}
                          {order.shippingAddress.province}{' '}
                          {order.shippingAddress.postalCode}
                        </div>

                        {/* Update status */}
                        <div className="mt-4 flex items-center gap-3">
                          <span className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                            {t('admin.orders.updateStatus')}
                          </span>
                          <select
                            value={order.status}
                            onChange={(e) =>
                              updateOrderStatus(order.id, e.target.value)
                            }
                            className="border border-neutral-200 bg-transparent px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                          >
                            {updateStatuses.map((s) => (
                              <option key={s} value={s}>
                                {t(`orders.status.${s}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
