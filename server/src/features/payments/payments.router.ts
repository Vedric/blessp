import { Router } from 'express';
import express from 'express';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { OrdersRepository } from '../orders/orders.repository';
import { authenticate } from '../../core/middleware/authenticate';

const ordersRepository = new OrdersRepository();
const paymentsService = new PaymentsService(ordersRepository);
const paymentsController = new PaymentsController(paymentsService);

const router = Router();

router.post('/create-intent', authenticate, paymentsController.createIntent);

// Webhook route must receive raw body for Stripe signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.webhook,
);

export { router as paymentsRouter };
