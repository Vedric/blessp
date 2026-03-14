import { prisma } from '../../core/database/client';
import type {
  OverviewStats,
  RevenueDataPoint,
  TopProduct,
  RecentOrder,
} from './analytics.types';

export class AnalyticsRepository {
  async getOverviewStats(): Promise<OverviewStats> {
    const [orderAggregation, totalCustomers] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalCents: true },
        _count: { id: true },
        _avg: { totalCents: true },
        where: {
          status: { not: 'cancelled' },
        },
      }),
      prisma.user.count({
        where: {
          isAdmin: false,
          deletedAt: null,
        },
      }),
    ]);

    return {
      totalRevenueCents: orderAggregation._sum.totalCents ?? 0,
      totalOrders: orderAggregation._count.id,
      totalCustomers,
      averageOrderValueCents: Math.round(orderAggregation._avg.totalCents ?? 0),
    };
  }

  async getRevenueByDay(days: number): Promise<RevenueDataPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { not: 'cancelled' },
      },
      select: {
        totalCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const revenueMap = new Map<string, { revenueCents: number; orderCount: number }>();

    // Pre-fill all dates in the range so the chart has no gaps
    for (let d = 0; d < days; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      const key = date.toISOString().slice(0, 10);
      revenueMap.set(key, { revenueCents: 0, orderCount: 0 });
    }

    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const existing = revenueMap.get(key) ?? { revenueCents: 0, orderCount: 0 };
      existing.revenueCents += order.totalCents;
      existing.orderCount += 1;
      revenueMap.set(key, existing);
    }

    return Array.from(revenueMap.entries()).map(([date, data]) => ({
      date,
      revenueCents: data.revenueCents,
      orderCount: data.orderCount,
    }));
  }

  async getTopProducts(limit: number): Promise<TopProduct[]> {
    // Fetch individual order items and aggregate in application code
    // to correctly compute revenue as SUM(unitPriceCents * quantity) per product
    const items = await prisma.orderItem.findMany({
      select: {
        productId: true,
        productName: true,
        quantity: true,
        unitPriceCents: true,
      },
    });

    const productMap = new Map<
      string,
      { productId: string | null; productName: string; totalQuantity: number; totalRevenueCents: number }
    >();

    for (const item of items) {
      const key = item.productName;
      const existing = productMap.get(key);
      const lineRevenue = item.unitPriceCents * item.quantity;

      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalRevenueCents += lineRevenue;
      } else {
        productMap.set(key, {
          productId: item.productId,
          productName: item.productName,
          totalQuantity: item.quantity,
          totalRevenueCents: lineRevenue,
        });
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }

  async getRecentOrders(limit: number): Promise<RecentOrder[]> {
    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      customerName: `${order.user.firstName} ${order.user.lastName}`,
      customerEmail: order.user.email,
      totalCents: order.totalCents,
      discountCents: order.discountCents,
      status: order.status,
      itemCount: order._count.items,
      createdAt: order.createdAt.toISOString(),
    }));
  }
}
