import { Request, Response, NextFunction } from 'express';
import { LoyaltyService } from './loyalty.service';
import { RedeemPointsSchema, LoyaltyQuerySchema } from './loyalty.schema';
import { sendSuccess, sendCreated, sendPaginated } from '../../core/types/response';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  getBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const balance = await this.loyaltyService.getBalance(authReq.user!.userId);

      sendSuccess(res, req, balance);
    } catch (error) {
      next(error);
    }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = LoyaltyQuerySchema.parse(req.query);
      const result = await this.loyaltyService.getTransactions(authReq.user!.userId, query);

      sendPaginated(res, req, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  };

  redeem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = RedeemPointsSchema.parse(req.body);
      const transaction = await this.loyaltyService.redeemPoints(authReq.user!.userId, dto);

      sendCreated(res, req, transaction);
    } catch (error) {
      next(error);
    }
  };
}
