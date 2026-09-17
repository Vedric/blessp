jest.mock('@core/database/client', () => ({ prisma: {} }));
jest.mock('@core/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AnalyticsService } from '@features/analytics/analytics.service';
import { AnalyticsRepository } from '@features/analytics/analytics.repository';

jest.mock('@features/analytics/analytics.repository');

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsRepository: jest.Mocked<AnalyticsRepository>;

  const overviewFixture = {
    totalRevenueCents: 500000,
    totalOrders: 42,
    totalCustomers: 30,
    averageOrderValueCents: 11905,
  };

  const revenueFixture = [
    { date: '2026-03-01', revenueCents: 25000, orderCount: 3 },
    { date: '2026-03-02', revenueCents: 18000, orderCount: 2 },
  ];

  const topProductsFixture = [
    { productId: 'prod_001', productName: 'Blessed Tee', totalQuantity: 15, totalRevenueCents: 60000 },
    { productId: 'prod_002', productName: 'Gold Chain', totalQuantity: 10, totalRevenueCents: 120000 },
  ];

  const recentOrdersFixture = [
    {
      id: 'ord_001',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      totalCents: 15000,
      discountCents: 0,
      status: 'paid',
      itemCount: 2,
      createdAt: '2026-03-10T14:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    analyticsRepository = {
      getOverviewStats: jest.fn(),
      getRevenueByDay: jest.fn(),
      getTopProducts: jest.fn(),
      getRecentOrders: jest.fn(),
    } as unknown as jest.Mocked<AnalyticsRepository>;

    service = new AnalyticsService(analyticsRepository);
  });

  describe('getOverview', () => {
    it('delegates to repository', async () => {
      analyticsRepository.getOverviewStats.mockResolvedValueOnce(overviewFixture);

      const result = await service.getOverview();

      expect(result).toEqual(overviewFixture);
      expect(analyticsRepository.getOverviewStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRevenue', () => {
    it('maps 7d to 7 days', async () => {
      analyticsRepository.getRevenueByDay.mockResolvedValueOnce(revenueFixture);

      await service.getRevenue('7d');

      expect(analyticsRepository.getRevenueByDay).toHaveBeenCalledWith(7);
    });

    it('maps 30d to 30 days', async () => {
      analyticsRepository.getRevenueByDay.mockResolvedValueOnce(revenueFixture);

      await service.getRevenue('30d');

      expect(analyticsRepository.getRevenueByDay).toHaveBeenCalledWith(30);
    });

    it('defaults to 30 days for unknown period', async () => {
      analyticsRepository.getRevenueByDay.mockResolvedValueOnce(revenueFixture);

      await service.getRevenue('unknown' as any);

      expect(analyticsRepository.getRevenueByDay).toHaveBeenCalledWith(30);
    });
  });

  describe('getTopProducts', () => {
    it('clamps limit to 1-50 range', async () => {
      analyticsRepository.getTopProducts.mockResolvedValueOnce(topProductsFixture);

      await service.getTopProducts(100);

      expect(analyticsRepository.getTopProducts).toHaveBeenCalledWith(50);
    });

    it('enforces minimum limit of 1', async () => {
      analyticsRepository.getTopProducts.mockResolvedValueOnce([]);

      await service.getTopProducts(0);

      expect(analyticsRepository.getTopProducts).toHaveBeenCalledWith(1);
    });
  });

  describe('getRecentOrders', () => {
    it('clamps limit to 1-50 range', async () => {
      analyticsRepository.getRecentOrders.mockResolvedValueOnce(recentOrdersFixture);

      await service.getRecentOrders(200);

      expect(analyticsRepository.getRecentOrders).toHaveBeenCalledWith(50);
    });
  });
});
