import { Request, Response, NextFunction } from 'express';
import { CurrencyService } from './currency.service';
import { sendSuccess } from '../../core/types/response';

export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  getRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = this.currencyService.getRates();

      sendSuccess(res, req, rates);
    } catch (error) {
      next(error);
    }
  };
}
