import { Request, Response, NextFunction } from 'express';
import { LoyaltyService } from './loyalty.service';
import { RedeemPointsSchema, LoyaltyQuerySchema } from './loyalty.schema';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  getBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const balance = await this.loyaltyService.getBalance(authReq.user!.userId);

      res.status(200).json({
        data: balance,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = LoyaltyQuerySchema.parse(req.query);
      const result = await this.loyaltyService.getTransactions(authReq.user!.userId, query);

      res.status(200).json({
        data: result.data,
        pagination: result.pagination,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  redeem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = RedeemPointsSchema.parse(req.body);
      const transaction = await this.loyaltyService.redeemPoints(authReq.user!.userId, dto);

      res.status(201).json({
        data: transaction,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
