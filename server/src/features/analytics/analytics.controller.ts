import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';
import { sendSuccess } from '../../core/types/response';
import type { RevenuePeriod } from './analytics.types';

const VALID_PERIODS: RevenuePeriod[] = ['7d', '30d', '90d'];

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const overview = await this.analyticsService.getOverview();

      sendSuccess(res, req, overview);
    } catch (error) {
      next(error);
    }
  };

  getRevenue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const period = (req.query.period as string) || '30d';

      if (!VALID_PERIODS.includes(period as RevenuePeriod)) {
        res.status(400).json({
          error: {
            code: 'INVALID_PERIOD',
            message: 'Period must be one of: 7d, 30d, 90d.',
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      const revenue = await this.analyticsService.getRevenue(period as RevenuePeriod);

      sendSuccess(res, req, revenue);
    } catch (error) {
      next(error);
    }
  };

  getTopProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
      const topProducts = await this.analyticsService.getTopProducts(limit);

      sendSuccess(res, req, topProducts);
    } catch (error) {
      next(error);
    }
  };

  getRecentOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
      const recentOrders = await this.analyticsService.getRecentOrders(limit);

      sendSuccess(res, req, recentOrders);
    } catch (error) {
      next(error);
    }
  };
}
