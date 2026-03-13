import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import { OrderTimeline } from '@/components/order/OrderTimeline';
import type { Order } from '@/lib/types';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  shipped: { label: 'Shipped', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  delivered: { label: 'Delivered', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-50 text-neutral-500 border-neutral-200' },
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/3 bg-neutral-100" />
            <div className="h-40 bg-neutral-100" />
            <div className="h-40 bg-neutral-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-500">Order not found.</p>
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.pending;
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
  const shipping = order.totalCents - subtotal;

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/profile/orders"
            className="mb-6 inline-flex items-center gap-1 text-xs font-medium tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Orders
          </Link>

          {/* Order header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
                Order #{order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Placed on {formatDate(order.createdAt)}
              </p>
            </div>
            <span
              className={cn(
                'border px-3 py-1 text-xs font-medium uppercase',
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>

          {/* Items */}
          <div className="mt-10 border border-neutral-100">
            <div className="border-b border-neutral-100 px-6 py-4">
              <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                Items
              </h2>
            </div>
            <div className="divide-y divide-neutral-50">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 px-6 py-4">
                  <div className="h-20 w-20 flex-shrink-0 bg-neutral-50">
                  </div>
                  <div className="flex flex-1 items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {item.size && item.size}
                        {item.size && item.color && ', '}
                        {item.color && item.color}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-neutral-900">
                      {formatPrice(item.unitPriceCents * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Timeline */}
          <div className="mt-6">
            <OrderTimeline orderId={order.id} currentStatus={order.status} />
          </div>

          {/* Shipping address */}
          <div className="mt-6 border border-neutral-100 p-6">
            <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
              Shipping Address
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
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
          </div>

          {/* Order totals */}
          <div className="mt-6 border border-neutral-100 p-6">
            <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
              Order Total
            </h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span className="text-neutral-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Shipping</span>
                <span className="text-neutral-900">
                  {shipping <= 0 ? 'Free' : formatPrice(shipping)}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-100 pt-3 text-sm font-medium">
                <span className="text-neutral-900">Total</span>
                <span className="text-neutral-900">
                  {formatPrice(order.totalCents)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
