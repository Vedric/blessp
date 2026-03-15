import Stripe from 'stripe';
import { SpanStatusCode } from '@opentelemetry/api';
import { Env } from '../../core/config/env';
import { NotFoundError, ForbiddenError, ValidationError } from '../../core/errors/http.errors';
import { OrdersRepository } from '../orders/orders.repository';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { LoyaltyRepository } from '../loyalty/loyalty.repository';
import { PaymentIntentResponse, PaymentMethodResponse } from './payments.types';
import { logger } from '../../core/observability/logger';
import { getTracer } from '../../core/observability/tracer';
import { prisma } from '../../core/database/client';

export class PaymentsService {
  private readonly stripe: Stripe | null;
  private readonly loyaltyService: LoyaltyService;

  constructor(private readonly ordersRepository: OrdersRepository) {
    if (Env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(Env.STRIPE_SECRET_KEY);
    } else {
      this.stripe = null;
      logger.warn('STRIPE_SECRET_KEY is not configured; payment features are disabled');
    }
    this.loyaltyService = new LoyaltyService(new LoyaltyRepository());
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ValidationError('Payment processing is not configured.');
    }
    return this.stripe;
  }

  async getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
    const stripe = this.requireStripe();

    const existing = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    await prisma.stripeCustomer.create({
      data: {
        userId,
        stripeCustomerId: customer.id,
      },
    });

    logger.info({ userId, stripeCustomerId: customer.id }, 'Stripe customer created');

    return customer.id;
  }

  async listPaymentMethods(userId: string, email: string): Promise<PaymentMethodResponse[]> {
    const stripe = this.requireStripe();
    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, email);

    const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
    const defaultPaymentMethodId = typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id ?? null;

    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    return methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? 'unknown',
      last4: pm.card?.last4 ?? '****',
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
      isDefault: pm.id === defaultPaymentMethodId,
    }));
  }

  async attachPaymentMethod(userId: string, email: string, paymentMethodId: string): Promise<PaymentMethodResponse> {
    const stripe = this.requireStripe();
    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, email);

    const pm = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    logger.info({ userId, paymentMethodId }, 'Payment method attached');

    return {
      id: pm.id,
      brand: pm.card?.brand ?? 'unknown',
      last4: pm.card?.last4 ?? '****',
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
      isDefault: false,
    };
  }

  async detachPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const stripe = this.requireStripe();

    const stripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });

    if (!stripeCustomer) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // Verify the payment method belongs to this customer before detaching
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (pm.customer !== stripeCustomer.stripeCustomerId) {
      throw new ForbiddenError('You do not have access to this payment method.');
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    logger.info({ userId, paymentMethodId }, 'Payment method detached');
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const stripe = this.requireStripe();

    const stripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });

    if (!stripeCustomer) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // Verify ownership before updating
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (pm.customer !== stripeCustomer.stripeCustomerId) {
      throw new ForbiddenError('You do not have access to this payment method.');
    }

    await stripe.customers.update(stripeCustomer.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    logger.info({ userId, paymentMethodId }, 'Default payment method updated');
  }

  /**
   * Detaches all payment methods for a user. Used during account deletion
   * to ensure no orphaned payment methods remain on the Stripe side.
   */
  async detachAllPaymentMethods(userId: string): Promise<void> {
    if (!this.stripe) {
      return;
    }

    const stripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });

    if (!stripeCustomer) {
      return;
    }

    const methods = await this.stripe.paymentMethods.list({
      customer: stripeCustomer.stripeCustomerId,
      type: 'card',
    });

    for (const pm of methods.data) {
      await this.stripe.paymentMethods.detach(pm.id);
    }

    logger.info({ userId, count: methods.data.length }, 'All payment methods detached for account deletion');
  }

  async createPaymentIntent(
    userId: string,
    orderId: string,
    currency: string = 'eur',
  ): Promise<PaymentIntentResponse> {
    const stripe = this.requireStripe();
    const tracer = getTracer('payments-service');
    const span = tracer.startSpan('createPaymentIntent', {
      attributes: {
        'payment.orderId': orderId,
        'payment.userId': userId,
        'payment.currency': currency,
      },
    });

    try {
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

      span.setAttribute('payment.amount', order.totalCents);

      // If the order already has a transaction key, retrieve the existing intent
      // to prevent duplicate charges on retries
      if (order.transactionKey) {
        const existingIntent = await stripe.paymentIntents.retrieve(order.transactionKey);

        if (existingIntent.status !== 'canceled') {
          span.setStatus({ code: SpanStatusCode.OK });
          return {
            clientSecret: existingIntent.client_secret!,
            paymentIntentId: existingIntent.id,
            amount: existingIntent.amount,
            currency: existingIntent.currency,
          };
        }
      }

      // Pass the Stripe customer ID when available so saved cards can be reused
      const stripeCustomer = await prisma.stripeCustomer.findUnique({
        where: { userId },
      });

      const intentParams: Stripe.PaymentIntentCreateParams = {
        amount: order.totalCents,
        currency,
        metadata: {
          orderId: order.id,
          userId,
        },
      };

      if (stripeCustomer) {
        intentParams.customer = stripeCustomer.stripeCustomerId;
      }

      const paymentIntent = await stripe.paymentIntents.create(intentParams);

      // Store the Stripe payment intent ID as the transaction key
      await this.ordersRepository.updateTransactionKey(orderId, paymentIntent.id);

      span.setStatus({ code: SpanStatusCode.OK });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.requireStripe();

    if (!Env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
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

          // Skip if already processed (idempotency)
          if (order && order.status === 'paid') {
            logger.info({ orderId }, 'Payment already processed, skipping duplicate webhook');
            break;
          }

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

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const orderId = charge.metadata?.orderId;

        if (orderId) {
          await this.ordersRepository.updateStatus(orderId, 'cancelled');
          logger.info(
            { orderId, chargeId: charge.id, amountRefunded: charge.amount_refunded },
            'Charge refunded, order marked as cancelled',
          );
        }
        break;
      }

      default:
        logger.debug({ eventType: event.type }, 'Unhandled Stripe webhook event');
    }
  }
}
