import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, CheckCircle, Clock, Truck, ShoppingBag } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { OrderStatusHistoryEntry } from '@/lib/types';

const TIMELINE_STEPS = [
  { status: 'pending', label: 'Order Placed', icon: ShoppingBag },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'processing', label: 'Processing', icon: Clock },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: Package },
] as const;

const BRAND_GOLD = '#c8a97e';

interface OrderTimelineProps {
  orderId: string;
  currentStatus: string;
}

export function OrderTimeline({ orderId, currentStatus }: OrderTimelineProps) {
  const [history, setHistory] = useState<OrderStatusHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      setIsLoading(true);
      try {
        const data = await api.get<OrderStatusHistoryEntry[]>(
          `/orders/${orderId}/timeline`,
        );
        setHistory(data);
      } catch {
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimeline();
  }, [orderId]);

  if (currentStatus === 'cancelled') {
    return (
      <div className="border border-neutral-100 p-6">
        <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
          Order Timeline
        </h2>
        <p className="mt-4 text-sm text-neutral-500">
          This order has been cancelled.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-neutral-100 p-6">
        <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
          Order Timeline
        </h2>
        <div className="mt-6 animate-pulse space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-neutral-100" />
                <div className="h-3 w-32 bg-neutral-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Build a lookup of status to its history entry (date, note)
  const historyByStatus = new Map<string, OrderStatusHistoryEntry>();
  for (const entry of history) {
    historyByStatus.set(entry.status, entry);
  }

  // Determine completed step index based on current order status
  const currentStepIndex = TIMELINE_STEPS.findIndex(
    (step) => step.status === currentStatus,
  );

  return (
    <div className="border border-neutral-100 p-6">
      <h2 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
        Order Timeline
      </h2>

      <div className="relative mt-8">
        {TIMELINE_STEPS.map((step, index) => {
          const entry = historyByStatus.get(step.status);
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isFuture = index > currentStepIndex;
          const Icon = step.icon;

          return (
            <motion.div
              key={step.status}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative flex gap-4 pb-8 last:pb-0"
            >
              {/* Vertical connector line */}
              {index < TIMELINE_STEPS.length - 1 && (
                <div className="absolute left-[15px] top-[36px] h-[calc(100%-28px)] w-px">
                  <div
                    className="h-full w-full transition-colors duration-500"
                    style={{
                      backgroundColor: isCompleted
                        ? BRAND_GOLD
                        : isCurrent
                          ? `${BRAND_GOLD}40`
                          : '#e5e5e5',
                    }}
                  />
                </div>
              )}

              {/* Circle icon */}
              <div className="relative z-10 flex-shrink-0">
                <motion.div
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-500"
                  style={{
                    backgroundColor: isCompleted || isCurrent
                      ? BRAND_GOLD
                      : '#f5f5f5',
                    border: isFuture ? '1.5px solid #d4d4d4' : 'none',
                  }}
                  animate={
                    isCurrent
                      ? {
                          boxShadow: [
                            `0 0 0 0px ${BRAND_GOLD}30`,
                            `0 0 0 8px ${BRAND_GOLD}00`,
                          ],
                        }
                      : {}
                  }
                  transition={
                    isCurrent
                      ? {
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeOut',
                        }
                      : {}
                  }
                >
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{
                      color: isCompleted || isCurrent ? '#ffffff' : '#a3a3a3',
                    }}
                    strokeWidth={2}
                  />
                </motion.div>
              </div>

              {/* Label and details */}
              <div className="flex-1 pt-1">
                <p
                  className="text-sm font-medium transition-colors duration-300"
                  style={{
                    color: isCompleted || isCurrent ? '#171717' : '#a3a3a3',
                  }}
                >
                  {step.label}
                </p>
                {entry && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 + 0.2 }}
                  >
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {formatDate(entry.createdAt)}
                    </p>
                    {entry.note && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {entry.note}
                      </p>
                    )}
                  </motion.div>
                )}
                {isCurrent && !entry && (
                  <p className="mt-0.5 text-xs text-neutral-400">
                    In progress
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
