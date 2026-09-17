import { Router } from 'express';
import { sendSuccess } from '../../core/types/response';
import { shippingRates } from './commerce.service';
import { paypalConfigured } from '../payments/paypal.gateway';
const router = Router();
router.get('/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, req, { currency: 'CAD', shippingRates: shippingRates(), payments: { paypal: paypalConfigured() } });
});
export { router as commerceRouter };
