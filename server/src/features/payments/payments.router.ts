import { Router } from 'express';
import express from 'express';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { OrdersRepository } from '../orders/orders.repository';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';

const ordersRepository = new OrdersRepository();
const paymentsService = new PaymentsService(ordersRepository);
const paymentsController = new PaymentsController(paymentsService);

const router = Router();

router.post('/create-intent', authenticate, paymentsController.createIntent);

// Saved payment methods (all require authentication)
router.get('/methods', authenticate, paymentsController.listMethods);
router.post('/methods', authenticate, paymentsController.attachMethod);
router.delete('/methods/:id', authenticate, paymentsController.detachMethod);
router.post('/methods/:id/default', authenticate, paymentsController.setDefaultMethod);

// Admin: refund an order
router.post('/refund', authenticate, authorizeAdmin, paymentsController.refund);

// Webhook route must receive raw body for Stripe signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.webhook,
);

export { router as paymentsRouter };
