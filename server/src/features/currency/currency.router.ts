import { Router } from 'express';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

const currencyService = new CurrencyService();
const currencyController = new CurrencyController(currencyService);

const router = Router();

router.get('/rates', currencyController.getRates);

export { router as currencyRouter };
