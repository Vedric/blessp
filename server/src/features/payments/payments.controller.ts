import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentSchema } from './payments.schema';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  createIntent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { orderId, currency } = CreatePaymentIntentSchema.parse(req.body);

      const paymentIntent = await this.paymentsService.createPaymentIntent(
        authReq.user!.userId,
        orderId,
        currency,
      );

      res.status(201).json({
        data: paymentIntent,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        res.status(400).json({
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'Missing Stripe webhook signature.',
          },
        });
        return;
      }

      // Express raw body is expected to be available on req.body when
      // the route uses express.raw() middleware
      await this.paymentsService.handleWebhook(req.body as Buffer, signature);

      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  };
}
