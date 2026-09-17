import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentIntentSchema,
  CreateGuestPaymentIntentSchema,
  AttachPaymentMethodSchema,
  RefundOrderSchema,
} from './payments.schema';
import { sendSuccess, sendCreated, sendNoContent } from '../../core/types/response';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  createSetupIntent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await this.paymentsService.createSetupIntent(
        authReq.user!.userId,
        authReq.user!.email,
      );

      sendCreated(res, req, result);
    } catch (error) {
      next(error);
    }
  };

  createGuestIntent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderId, email } = CreateGuestPaymentIntentSchema.parse(req.body);
      const intent = await this.paymentsService.createGuestPaymentIntent(orderId, email);
      sendCreated(res, req, intent);
    } catch (error) {
      next(error);
    }
  };

  createIntent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { orderId } = CreatePaymentIntentSchema.parse(req.body);

      const paymentIntent = await this.paymentsService.createPaymentIntent(
        authReq.user!.userId,
        orderId,
      );

      sendCreated(res, req, paymentIntent);
    } catch (error) {
      next(error);
    }
  };

  listMethods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const methods = await this.paymentsService.listPaymentMethods(authReq.user!.userId);

      sendSuccess(res, req, methods);
    } catch (error) {
      next(error);
    }
  };

  attachMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { paymentMethodId } = AttachPaymentMethodSchema.parse(req.body);

      const method = await this.paymentsService.attachPaymentMethod(
        authReq.user!.userId,
        authReq.user!.email,
        paymentMethodId,
      );

      sendCreated(res, req, method);
    } catch (error) {
      next(error);
    }
  };

  detachMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      await this.paymentsService.detachPaymentMethod(
        authReq.user!.userId,
        req.params.id as string,
      );

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  setDefaultMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      await this.paymentsService.setDefaultPaymentMethod(
        authReq.user!.userId,
        req.params.id as string,
      );

      sendSuccess(res, req, { message: 'Default payment method updated.' });
    } catch (error) {
      next(error);
    }
  };

  refund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderId, reason, expectedRefundedCents } = RefundOrderSchema.parse(req.body);
      const result = await this.paymentsService.refundOrder(orderId, reason, expectedRefundedCents);

      sendSuccess(res, req, result);
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
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      // Express raw body is expected to be available on req.body when
      // the route uses express.raw() middleware
      await this.paymentsService.handleWebhook(req.body as Buffer, signature);

      sendSuccess(res, req, { received: true });
    } catch (error) {
      next(error);
    }
  };
}
