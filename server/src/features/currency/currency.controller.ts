import { Request, Response, NextFunction } from 'express';
import { CurrencyService } from './currency.service';

export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  getRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = this.currencyService.getRates();

      res.status(200).json({
        data: rates,
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
