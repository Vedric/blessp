import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  Package,
  Star,
  Trash2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { cn } from '@/lib/utils';

/* ── Types ── */

interface OverviewStats {
  totalRevenueCents: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValueCents: number;
}

interface RevenueDataPoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}

interface TopProduct {
  productId: string | null;
  productName: string;
  totalQuantity: number;
  totalRevenueCents: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  discountCents: number;
  status: string;
  itemCount: number;
  createdAt: string;
}

interface AdminReview {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  user: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

type RevenuePeriod = '7d' | '30d' | '90d';

/* ── Animations ── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ── Status config ── */

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  shipped: { label: 'Shipped', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  delivered: { label: 'Delivered', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-neutral-50 text-neutral-500 border-neutral-200' },
};

/* ── Skeleton components ── */

function KpiSkeleton() {
  return (
    <div className="animate-pulse border border-neutral-100 p-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-full bg-neutral-100" />
        <div className="h-4 w-12 bg-neutral-100" />
      </div>
      <div className="mt-4 h-8 w-28 bg-neutral-100" />
      <div className="mt-2 h-4 w-20 bg-neutral-100" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse border border-neutral-100 p-6">
      <div className="h-5 w-32 bg-neutral-100" />
      <div className="mt-6 flex items-end gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-neutral-100"
            style={{ height: `${30 + Math.random() * 100}px` }}
          />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse border border-neutral-100 p-6">
      <div className="h-5 w-40 bg-neutral-100" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-32 bg-neutral-100" />
            <div className="h-4 flex-1 bg-neutral-100" />
            <div className="h-4 w-16 bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Revenue chart (pure CSS) ── */

function RevenueChart({
  data,
  period,
  onPeriodChange,
  formatPrice,
}: {
  data: RevenueDataPoint[];
  period: RevenuePeriod;
  onPeriodChange: (p: RevenuePeriod) => void;
  formatPrice: (cents: number) => string;
}) {
  const maxRevenue = Math.max(...data.map((d) => d.revenueCents), 1);
  const totalRevenue = data.reduce((sum, d) => sum + d.revenueCents, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orderCount, 0);

  // Determine label frequency based on period
  const labelEvery = period === '7d' ? 1 : period === '30d' ? 5 : 10;

  return (
    <div className="border border-neutral-100 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium tracking-widest text-neutral-500 uppercase">
            Revenue
          </h2>
          <p className="mt-1 text-2xl font-light text-neutral-900">
            {formatPrice(totalRevenue)}
          </p>
          <p className="text-xs text-neutral-400">
            {totalOrders} order{totalOrders !== 1 ? 's' : ''} in period
          </p>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as RevenuePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium tracking-wider uppercase transition-colors',
                period === p
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="mt-6 flex items-end gap-[2px]" style={{ height: 180 }}>
        {data.map((point, i) => {
          const height = maxRevenue > 0 ? (point.revenueCents / maxRevenue) * 100 : 0;
          return (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center"
              style={{ height: '100%' }}
            >
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-16 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap border border-neutral-100 bg-white px-3 py-2 text-xs shadow-sm group-hover:block">
                <p className="font-medium text-neutral-900">
                  {formatPrice(point.revenueCents)}
                </p>
                <p className="text-neutral-400">
                  {point.orderCount} order{point.orderCount !== 1 ? 's' : ''}
                </p>
                <p className="text-neutral-400">
                  {new Date(point.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {/* Bar */}
              <div className="mt-auto w-full">
                <div
                  className="w-full bg-[#c8a97e]/70 transition-colors group-hover:bg-[#c8a97e]"
                  style={{
                    height: `${Math.max(height, 2)}%`,
                    minHeight: point.revenueCents > 0 ? '4px' : '1px',
                  }}
                />
              </div>

              {/* X-axis label */}
              {i % labelEvery === 0 && (
                <span className="mt-2 text-[10px] text-neutral-400">
                  {new Date(point.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Stars component ── */

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= rating ? 'fill-[#c8a97e] text-[#c8a97e]' : 'text-neutral-200',
          )}
        />
      ))}
    </div>
  );
}

/* ── Main component ── */

export default function AdminDashboardPage() {
  const { formatPrice } = useCurrency();

  // Overview stats
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Revenue
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('30d');
  const [revenueLoading, setRevenueLoading] = useState(true);

  // Top products
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topProductsLoading, setTopProductsLoading] = useState(true);

  // Recent orders
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(true);

  // Reviews
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  // Fetch overview stats
  useEffect(() => {
    api
      .get<OverviewStats>('/analytics/overview')
      .then((data) => setOverview(data))
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, []);

  // Fetch revenue data
  const fetchRevenue = useCallback(async (period: RevenuePeriod) => {
    setRevenueLoading(true);
    try {
      const data = await api.get<RevenueDataPoint[]>(
        `/analytics/revenue?period=${period}`,
      );
      setRevenue(data);
    } catch {
      setRevenue([]);
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenue(revenuePeriod);
  }, [revenuePeriod, fetchRevenue]);

  // Fetch top products
  useEffect(() => {
    api
      .get<TopProduct[]>('/analytics/top-products?limit=10')
      .then((data) => setTopProducts(data))
      .catch(() => {})
      .finally(() => setTopProductsLoading(false));
  }, []);

  // Fetch recent orders
  useEffect(() => {
    api
      .get<RecentOrder[]>('/analytics/recent-orders?limit=10')
      .then((data) => setRecentOrders(data))
      .catch(() => {})
      .finally(() => setRecentOrdersLoading(false));
  }, []);

  // Fetch reviews
  useEffect(() => {
    api
      .getRaw<{
        data: AdminReview[];
        pagination: { page: number; perPage: number; totalItems: number; totalPages: number };
      }>('/reviews/admin/all?page=1&perPage=20')
      .then((res) => setReviews(res.data))
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, []);

  const handleDeleteReview = async (reviewId: string) => {
    setDeletingReviewId(reviewId);
    try {
      await api.delete(`/reviews/admin/${reviewId}`);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch {
      // Silently handle
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handlePeriodChange = (p: RevenuePeriod) => {
    setRevenuePeriod(p);
  };

  /* ── KPI cards data ── */
  const kpiCards: Array<{
    label: string;
    value: string | number;
    icon: typeof DollarSign;
    trend: { direction: 'up' | 'down' | 'neutral'; label: string };
  }> = overview
    ? [
        {
          label: 'Total Revenue',
          value: formatPrice(overview.totalRevenueCents),
          icon: DollarSign,
          trend: { direction: 'up', label: 'All time' },
        },
        {
          label: 'Total Orders',
          value: overview.totalOrders.toLocaleString(),
          icon: ShoppingBag,
          trend: { direction: 'up' as const, label: 'All time' },
        },
        {
          label: 'Customers',
          value: overview.totalCustomers.toLocaleString(),
          icon: Users,
          trend: { direction: 'up' as const, label: 'Registered' },
        },
        {
          label: 'Avg Order Value',
          value: formatPrice(overview.averageOrderValueCents),
          icon: TrendingUp,
          trend: { direction: 'neutral' as const, label: 'Per order' },
        },
      ]
    : [];

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900 md:text-4xl">
            Dashboard
          </h1>
          <div className="mt-2 h-px w-12 bg-[#c8a97e]" />

          {/* ── KPI Cards ── */}
          <motion.div
            className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {overviewLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <KpiSkeleton key={i} />
                ))
              : kpiCards.map((card) => (
                  <motion.div
                    key={card.label}
                    variants={fadeUp}
                    className="border border-neutral-100 p-6 transition-colors hover:border-neutral-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c8a97e]/10">
                        <card.icon className="h-4 w-4 text-[#c8a97e]" />
                      </div>
                      <span className="flex items-center gap-1 text-xs text-neutral-400">
                        {card.trend.direction === 'up' && (
                          <ArrowUpRight className="h-3 w-3 text-green-500" />
                        )}
                        {card.trend.direction === 'down' && (
                          <ArrowDownRight className="h-3 w-3 text-red-500" />
                        )}
                        {card.trend.label}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-light text-neutral-900">
                      {card.value}
                    </p>
                    <p className="mt-1 text-xs font-medium tracking-widest text-neutral-500 uppercase">
                      {card.label}
                    </p>
                  </motion.div>
                ))}
          </motion.div>

          {/* ── Revenue Chart ── */}
          <motion.div
            className="mt-8"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            {revenueLoading ? (
              <ChartSkeleton />
            ) : (
              <RevenueChart
                data={revenue}
                period={revenuePeriod}
                onPeriodChange={handlePeriodChange}
                formatPrice={formatPrice}
              />
            )}
          </motion.div>

          {/* ── Two column layout: Top Products + Recent Orders ── */}
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            {/* Top Products */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              {topProductsLoading ? (
                <TableSkeleton />
              ) : (
                <div className="border border-neutral-100 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium tracking-widest text-neutral-500 uppercase">
                      Top Products
                    </h2>
                    <Link
                      to="/admin/products"
                      className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-neutral-900"
                    >
                      View all
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="mt-6 space-y-3">
                    {topProducts.length === 0 ? (
                      <p className="py-8 text-center text-sm text-neutral-400">
                        No product data yet
                      </p>
                    ) : (
                      topProducts.map((product, i) => (
                        <div
                          key={product.productId ?? i}
                          className="flex items-center gap-4"
                        >
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-xs font-medium text-neutral-400">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-900">
                              {product.productName}
                            </p>
                            <p className="text-xs text-neutral-400">
                              {product.totalQuantity} sold
                            </p>
                          </div>
                          <span className="flex-shrink-0 text-sm font-medium text-neutral-700">
                            {formatPrice(product.totalRevenueCents)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Recent Orders */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              {recentOrdersLoading ? (
                <TableSkeleton />
              ) : (
                <div className="border border-neutral-100 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium tracking-widest text-neutral-500 uppercase">
                      Recent Orders
                    </h2>
                    <Link
                      to="/admin/orders"
                      className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-neutral-900"
                    >
                      View all
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="mt-6 space-y-3">
                    {recentOrders.length === 0 ? (
                      <p className="py-8 text-center text-sm text-neutral-400">
                        No orders yet
                      </p>
                    ) : (
                      recentOrders.map((order) => {
                        const status = statusConfig[order.status] ?? statusConfig.pending;
                        return (
                          <div
                            key={order.id}
                            className="flex items-center gap-3"
                          >
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-50">
                              <Package className="h-3.5 w-3.5 text-neutral-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-neutral-900">
                                {order.customerName}
                              </p>
                              <p className="text-xs text-neutral-400">
                                {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                                {' \u00b7 '}
                                {new Date(order.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'flex-shrink-0 border px-2 py-0.5 text-[10px] font-medium uppercase',
                                status.className,
                              )}
                            >
                              {status.label}
                            </span>
                            <span className="flex-shrink-0 text-sm font-medium text-neutral-700">
                              {formatPrice(order.totalCents)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Reviews Management ── */}
          <motion.div
            className="mt-8"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            {reviewsLoading ? (
              <TableSkeleton rows={6} />
            ) : (
              <div className="border border-neutral-100 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium tracking-widest text-neutral-500 uppercase">
                    Recent Reviews
                  </h2>
                  <span className="text-xs text-neutral-400">
                    {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {reviews.length === 0 ? (
                    <p className="py-8 text-center text-sm text-neutral-400">
                      No reviews yet
                    </p>
                  ) : (
                    reviews.map((review) => (
                      <div
                        key={review.id}
                        className="flex items-start gap-4 border-b border-neutral-50 pb-4 last:border-0 last:pb-0"
                      >
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-50 text-xs font-medium text-neutral-500">
                          {review.user.firstName[0]}
                          {review.user.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-900">
                              {review.user.firstName} {review.user.lastName}
                            </span>
                            <Stars rating={review.rating} />
                          </div>
                          <p className="mt-0.5 text-xs text-[#c8a97e]">
                            {review.productName}
                          </p>
                          {review.title && (
                            <p className="mt-1 text-sm font-medium text-neutral-700">
                              {review.title}
                            </p>
                          )}
                          {review.comment && (
                            <p className="mt-0.5 text-sm text-neutral-500 line-clamp-2">
                              {review.comment}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-neutral-400">
                            {new Date(review.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          disabled={deletingReviewId === review.id}
                          className={cn(
                            'flex-shrink-0 p-2 text-neutral-300 transition-colors hover:text-red-500',
                            deletingReviewId === review.id && 'cursor-not-allowed opacity-50',
                          )}
                          title="Delete review"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* ── Quick navigation ── */}
          <div className="mt-12">
            <h2 className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
              Manage
            </h2>
            <div className="mt-4 space-y-2">
              <Link
                to="/admin/products"
                className="flex items-center justify-between border border-neutral-100 p-5 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-5 w-5 text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-900">
                    Products
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
              <Link
                to="/admin/orders"
                className="flex items-center justify-between border border-neutral-100 p-5 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-900">
                    Orders
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
