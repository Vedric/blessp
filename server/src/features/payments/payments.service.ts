import Stripe from 'stripe';
import { Env } from '../../core/config/env';
import { NotFoundError, ForbiddenError, ValidationError } from '../../core/errors/http.errors';
import { OrdersRepository } from '../orders/orders.repository';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { LoyaltyRepository } from '../loyalty/loyalty.repository';
import { PaymentIntentResponse } from './payments.types';
import { logger } from '../../core/observability/logger';

export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly loyaltyService: LoyaltyService;

  constructor(private readonly ordersRepository: OrdersRepository) {
    if (!Env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured.');
    }
    this.stripe = new Stripe(Env.STRIPE_SECRET_KEY);
    this.loyaltyService = new LoyaltyService(new LoyaltyRepository());
  }

  async createPaymentIntent(
    userId: string,
    orderId: string,
    currency: string = 'eur',
  ): Promise<PaymentIntentResponse> {
    const order = await this.ordersRepository.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.userId !== userId) {
      throw new ForbiddenError('You do not have access to this order.');
    }

    if (order.status !== 'pending') {
      throw new ValidationError(
        `Cannot create a payment intent for an order with status '${order.status}'.`,
      );
    }

    if (order.totalCents <= 0) {
      throw new ValidationError('Order total must be greater than zero.');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: order.totalCents,
      currency,
      metadata: {
        orderId: order.id,
        userId,
      },
    });

    // Store the Stripe payment intent ID as the transaction key
    await this.ordersRepository.updateTransactionKey(orderId, paymentIntent.id);

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!Env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        Env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.warn({ err }, 'Stripe webhook signature verification failed');
      throw new ValidationError('Invalid webhook signature.');
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.orderId;

        if (orderId) {
          const order = await this.ordersRepository.findById(orderId);
          await this.ordersRepository.updateStatus(orderId, 'paid');
          logger.info({ orderId, paymentIntentId: paymentIntent.id }, 'Payment succeeded, order marked as paid');

          // Award loyalty points for the completed payment
          if (order) {
            this.loyaltyService
              .awardPointsForOrder(order.userId, orderId, order.totalCents)
              .catch((err) => {
                logger.error({ err, orderId }, 'Failed to award loyalty points for order');
              });
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.orderId;

        if (orderId) {
          await this.ordersRepository.updateStatus(orderId, 'cancelled');
          logger.warn(
            { orderId, paymentIntentId: paymentIntent.id },
            'Payment failed, order marked as cancelled',
          );
        }
        break;
      }

      default:
        logger.debug({ eventType: event.type }, 'Unhandled Stripe webhook event');
    }
  }
}
