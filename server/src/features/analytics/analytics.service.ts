import { AnalyticsRepository } from './analytics.repository';
import type {
  OverviewStats,
  RevenueDataPoint,
  TopProduct,
  RecentOrder,
  RevenuePeriod,
} from './analytics.types';

const PERIOD_DAYS: Record<RevenuePeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async getOverview(): Promise<OverviewStats> {
    return this.analyticsRepository.getOverviewStats();
  }

  async getRevenue(period: RevenuePeriod): Promise<RevenueDataPoint[]> {
    const days = PERIOD_DAYS[period] ?? 30;
    return this.analyticsRepository.getRevenueByDay(days);
  }

  async getTopProducts(limit: number): Promise<TopProduct[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    return this.analyticsRepository.getTopProducts(safeLimit);
  }

  async getRecentOrders(limit: number): Promise<RecentOrder[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    return this.analyticsRepository.getRecentOrders(safeLimit);
  }
}
