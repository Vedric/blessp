import { z } from 'zod';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/http.errors';
import type { AuthenticatedRequest } from '../../core/types/request.context';
import { Router } from 'express';
import express from 'express';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { OrdersRepository } from '../orders/orders.repository';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';
import { webhookRateLimiter } from '../../core/middleware/rate.limit';

const ordersRepository = new OrdersRepository();
const paymentsService = new PaymentsService(ordersRepository);
const paymentsController = new PaymentsController(paymentsService);

const router = Router();

const paypalOrderSchema = z.object({ orderId: z.string().uuid(), email: z.string().trim().email().toLowerCase().max(254).optional() }).strict();
for (const action of ['create', 'capture'] as const) {
  router.post(`/paypal/${action}`, (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next(), async (req, res) => {
    const { orderId, email } = paypalOrderSchema.parse(req.body);
    const user = (req as unknown as AuthenticatedRequest).user;
    const data = await paymentsService.paypal[action](orderId, user?.userId ?? null, email);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data });
  });
}
router.post('/paypal/webhook', webhookRateLimiter, async (req, res) => {
  await paymentsService.paypal.webhook(req.headers, req.body);
  res.json({ data: { received: true } });
});

router.post('/cancel', (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next(), async (req, res) => {
  const { orderId, email } = z.object({ orderId: z.string().uuid(), email: z.string().email().optional() }).parse(req.body);
  const order = await ordersRepository.findById(orderId);
  if (!order) throw new NotFoundError('Order', orderId);
  const user = (req as unknown as AuthenticatedRequest).user;
  if (!user?.isAdmin && (order.userId ? order.userId !== user?.userId : order.guestEmail !== email?.toLowerCase().trim())) throw new ForbiddenError('You do not have access to this order.');
  const outcome = await paymentsService.cancelPendingOrder(orderId);
  if (outcome === 'paid') throw new ConflictError('Payment already succeeded. View your order status.');
  res.status(204).end();
});
router.post('/create-intent', authenticate, paymentsController.createIntent);
router.post('/guest-create-intent', paymentsController.createGuestIntent);
router.post('/setup-intent', authenticate, paymentsController.createSetupIntent);

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
  webhookRateLimiter,
  express.raw({ type: 'application/json' }),
  paymentsController.webhook,
);

export { router as paymentsRouter };
