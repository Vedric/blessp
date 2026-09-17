import Stripe from 'stripe';
import { SpanStatusCode } from '@opentelemetry/api';
import { Env } from '../../core/config/env';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../core/errors/http.errors';
import { OrdersRepository } from '../orders/orders.repository';
import { releaseReservation } from '../orders/orders.service';
import { transaction, lockResource } from '../../core/database/transaction';
import { Prisma, type Order, type OrderItem } from '@prisma/client';
import { enqueueEmail } from '../../core/email/outbox';
import { orderConfirmationPayload } from '../orders/order.emails';
import { PaymentIntentResponse, PaymentMethodResponse } from './payments.types';
import { logger } from '../../core/observability/logger';
import { getTracer } from '../../core/observability/tracer';
import { paymentAmountMismatchTotal } from '../../core/observability/metrics';
import { prisma } from '../../core/database/client';
import { PaypalService } from './paypal.service';

// Orders are priced and settled in CAD cents. The multi-currency prices shown
// in the storefront are presentment-only (display conversion), so every
// PaymentIntent and SetupIntent we create charges the settlement currency.
// This also lets the webhook handler compare the charged amount against
// Order.totalCents exactly, without exchange-rate ambiguity.
const STORE_CURRENCY = 'cad';

export class PaymentsService {
  readonly paypal = new PaypalService((tx, order, refund) => this.recordPayment(tx, order, refund));
  private readonly stripe: Stripe | null;

  constructor(private readonly ordersRepository: OrdersRepository) {
    if (Env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(Env.STRIPE_SECRET_KEY, { timeout: 8000, maxNetworkRetries: 0 });
    } else {
      this.stripe = null;
      logger.warn('STRIPE_SECRET_KEY is not configured; payment features are disabled');
    }
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
    }, { idempotencyKey: `customer-${userId}` });

    await prisma.stripeCustomer.upsert({
      where: { userId }, update: {}, create: {
        userId,
        stripeCustomerId: customer.id,
      },
    });

    logger.info({ userId, stripeCustomerId: customer.id }, 'Stripe customer created');

    return customer.id;
  }

  async listPaymentMethods(userId: string): Promise<PaymentMethodResponse[]> {
    // Reading an empty wallet must not create a customer at the payment provider.
    const existing = await prisma.stripeCustomer.findUnique({ where: { userId } });
    if (!existing) return [];
    const stripe = this.requireStripe();
    const stripeCustomerId = existing.stripeCustomerId;

    const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
    const defaultPaymentMethodId = typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id ?? null;

    // Omit the type filter so wallets (PayPal, Link, Apple/Google Pay, etc.)
    // are returned alongside cards.
    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
    });

    return methods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      brand: pm.card?.brand ?? '',
      last4: pm.card?.last4 ?? '',
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
      type: pm.type,
      brand: pm.card?.brand ?? '',
      last4: pm.card?.last4 ?? '',
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

    for await (const pm of this.stripe.paymentMethods.list({ customer: stripeCustomer.stripeCustomerId, limit: 100 })) {
      await this.stripe.paymentMethods.detach(pm.id);
    }
    await this.stripe.customers.del(stripeCustomer.stripeCustomerId);
    await prisma.stripeCustomer.deleteMany({ where: { userId } });
    logger.info({ userId }, 'Stripe customer removed for account deletion');
  }

  async createSetupIntent(userId: string, email: string): Promise<{ clientSecret: string }> {
    const stripe = this.requireStripe();
    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, email);

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
    });

    return { clientSecret: setupIntent.client_secret! };
  }

  async createGuestPaymentIntent(orderId: string, guestEmail: string): Promise<PaymentIntentResponse> {
    return this.createIntent(orderId, null, guestEmail.toLowerCase().trim());
  }

  async createPaymentIntent(userId: string, orderId: string): Promise<PaymentIntentResponse> {
    return this.createIntent(orderId, userId);
  }

  private async createIntent(orderId: string, userId: string | null, guestEmail?: string): Promise<PaymentIntentResponse> {
    const stripe = this.requireStripe();
    return transaction(async (tx) => {
      await lockResource(tx, `order:${orderId}`);
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError('Order', orderId);
      if (order.userId !== userId || (!userId && order.guestEmail !== guestEmail)) throw new ForbiddenError('You do not have access to this order.');
      if (order.paymentProvider === 'paypal') throw new ConflictError('Cancel the existing PayPal payment before changing provider.');
      if (order.status !== 'pending' || order.paymentStatus !== 'pending' || order.stockReleasedAt || (order.expiresAt && order.expiresAt <= new Date())) throw new ValidationError('This reservation is no longer payable. Start a new checkout.');
      if (order.totalCents <= 0) throw new ValidationError('Order total must be greater than zero.');
      let intent: Stripe.PaymentIntent;
      if (order.transactionKey) {
        intent = await stripe.paymentIntents.retrieve(order.transactionKey);
        if (intent.status === 'canceled') throw new ValidationError('Payment was cancelled. Start a new checkout.');
      } else {
        intent = await stripe.paymentIntents.create({
          amount: order.totalCents, currency: STORE_CURRENCY,
          automatic_payment_methods: { enabled: true },
          ...(order.guestEmail ? { receipt_email: order.guestEmail } : {}),
          metadata: { orderId: order.id },
        }, { idempotencyKey: `order-payment-${order.id}` });
        await tx.order.update({ where: { id: order.id }, data: { transactionKey: intent.id } });
      }
      return { clientSecret: intent.client_secret!, paymentIntentId: intent.id, amount: intent.amount, currency: intent.currency };
    });
  }

  /** Cancellation at Stripe precedes releasing stock, even when webhooks are delayed. */
  async cancelPendingOrder(orderId: string): Promise<'paid' | 'cancelled'> {
    return transaction(async (tx) => {
      await lockResource(tx, `order:${orderId}`);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.status === 'cancelled') return 'cancelled' as const;
      if (order.paymentStatus !== 'pending' || order.status !== 'pending') throw new ValidationError('Only unpaid reservations can be cancelled.');
      if (order.transactionKey) {
        if (order.paymentProvider === 'paypal') {
          if (await this.paypal.beforeCancel(tx, order) === 'paid') return 'paid' as const;
        } else {
        const stripe = this.requireStripe();
        const intent = await stripe.paymentIntents.retrieve(order.transactionKey);
        if (intent.id !== order.transactionKey || intent.currency !== STORE_CURRENCY || intent.amount !== order.totalCents || (intent.status === 'succeeded' && intent.amount_received !== order.totalCents)) throw new ValidationError('Payment binding, amount or currency mismatch.');
        if (intent.status === 'succeeded') {
          await this.recordPayment(tx, order);
          return 'paid' as const;
        }
        if (intent.status !== 'canceled') await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `cancel-${order.id}` });
        }
      }
      await releaseReservation(tx, order);
      await tx.orderStatusHistory.create({ data: { orderId, status: 'cancelled', note: 'Unpaid reservation cancelled; stock and coupon released.' } });
      return 'cancelled' as const;
    });
  }

  async expireReservations(): Promise<void> {
    const expired = await prisma.order.findMany({ where: { status: 'pending', paymentStatus: 'pending', expiresAt: { lte: new Date() } }, select: { id: true }, take: 25, orderBy: { expiresAt: 'asc' } });
    for (const order of expired) {
      try { await this.cancelPendingOrder(order.id); }
      catch { logger.warn({ orderId: order.id }, 'Reservation could not be cancelled; inventory retained for retry'); }
    }
  }

  async refundOrder(orderId: string, reason?: string, expectedRefundedCents?: number): Promise<{ refundId: string; amountRefunded: number }> {
    const provider = await this.ordersRepository.findById(orderId);
    if (provider?.paymentProvider === 'paypal') return this.paypal.refund(orderId, expectedRefundedCents);
    const stripe = this.requireStripe();
    const tracer = getTracer('payments-service');
    const span = tracer.startSpan('refundOrder', {
      attributes: { 'refund.orderId': orderId },
    });

    try {
      const order = provider;

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      if (!order.transactionKey) {
        throw new ValidationError('No payment was recorded for this order.');
      }

      if (expectedRefundedCents !== undefined && expectedRefundedCents !== order.refundedCents) throw new ConflictError('Refund balance changed. Reload the order before requesting a refund.');
      if (!['paid', 'partially_refunded'].includes(order.paymentStatus)) throw new ValidationError('Only paid orders can be refunded.');
      const refund = await stripe.refunds.create({
        payment_intent: order.transactionKey,
        reason: 'requested_by_customer',
        metadata: {
          orderId,
          internalReason: reason ?? 'Admin-initiated refund',
        },
      }, { idempotencyKey: `full-refund-${order.id}` });

      logger.info(
        { orderId, refundId: refund.id, amount: refund.amount },
        'Stripe refund created',
      );

      span.setStatus({ code: SpanStatusCode.OK });

      return {
        refundId: refund.id,
        amountRefunded: refund.amount,
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

    const object = event.data.object as Stripe.PaymentIntent | Stripe.Charge;
    const intentId = event.type === 'charge.refunded'
      ? (typeof (object as Stripe.Charge).payment_intent === 'string' ? (object as Stripe.Charge).payment_intent as string : ((object as Stripe.Charge).payment_intent as Stripe.PaymentIntent | null)?.id)
      : object.id;
    await transaction(async (tx) => {
      const claim = await tx.stripeWebhookEvent.createMany({ data: [{ id: event.id, type: event.type }], skipDuplicates: true });
      if (!claim.count) return;
      if (!['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled', 'charge.refunded'].includes(event.type)) return;
      const reference = object.metadata?.orderId;
      const candidate = reference ? await tx.order.findUnique({ where: { id: reference } }) : intentId ? await tx.order.findUnique({ where: { transactionKey: intentId } }) : null;
      if (!candidate) return;
      if (candidate.paymentProvider === 'paypal') throw new ValidationError('Payment provider mismatch.');
      await lockResource(tx, `order:${candidate.id}`);
      const order = await tx.order.findUniqueOrThrow({ where: { id: candidate.id }, include: { items: true } });
      // A webhook can beat the transaction which saves the intent. Roll back
      // the claim so Stripe retries instead of permanently losing the event.
      if (!order.transactionKey) throw new Error('Payment binding is not committed yet; retry webhook.');
      if (order.transactionKey !== intentId || object.currency !== STORE_CURRENCY || object.amount !== order.totalCents || (event.type === 'payment_intent.succeeded' && (object as Stripe.PaymentIntent).amount_received !== order.totalCents)) {
        paymentAmountMismatchTotal.inc();
        logger.error({ orderId: order.id, eventId: event.id }, 'Stripe binding, amount or currency mismatch');
        await tx.orderStatusHistory.create({ data: { orderId: order.id, status: order.status, note: `Payment mismatch: ${event.id}; manual investigation required.` } });
        return;
      }
      if (event.type === 'payment_intent.succeeded') {
        await this.recordPayment(tx, order);
      } else if (event.type === 'charge.refunded') {
        const amount = (object as Stripe.Charge).amount_refunded;
        if (!Number.isSafeInteger(amount) || amount < 0 || amount > order.totalCents) throw new ValidationError('Invalid refunded amount.');
        // Cumulative amount is monotonic, including events arriving out of order.
        await this.recordPayment(tx, order, Math.max(order.refundedCents, amount));
      } else if (event.type === 'payment_intent.canceled') {
        if (order.paymentStatus === 'pending') {
          await releaseReservation(tx, order);
          await tx.orderStatusHistory.create({ data: { orderId: order.id, status: 'cancelled', note: 'Stripe payment cancelled; reservation released.' } });
        }
      } else {
        await tx.orderStatusHistory.create({ data: { orderId: order.id, status: order.status, note: 'Payment attempt failed. Retry is available while the reservation is active.' } });
      }
    });
  }

  private async recordPayment(tx: Prisma.TransactionClient, order: Order & { items: OrderItem[] }, refund = order.refundedCents): Promise<void> {
    if (order.stockReleasedAt || order.status === 'cancelled') {
      paymentAmountMismatchTotal.inc();
      throw new Error('Payment received after inventory release; manual reconciliation required.');
    }
    const firstPayment = order.paymentStatus === 'pending';
    const paymentStatus = refund === order.totalCents ? 'refunded' : refund > 0 ? 'partially_refunded' : 'paid';
    const status = order.status === 'pending' ? 'paid' : order.status;
    await tx.order.update({ where: { id: order.id }, data: { status, paymentStatus, refundedCents: refund, couponReserved: false } });
    if (firstPayment || refund !== order.refundedCents) await tx.orderStatusHistory.create({ data: { orderId: order.id, status, note: `Payment ${paymentStatus}; refunded ${refund} CAD cents.` } });
    if (order.userId) {
      await lockResource(tx, `loyalty:${order.userId}`);
      const earned = await tx.loyaltyTransaction.aggregate({ where: { orderId: order.id, type: { in: ['earned', 'reversed'] } }, _sum: { points: true } });
      const target = Math.floor((order.totalCents - refund) / 100);
      const delta = target - (earned._sum.points ?? 0);
      if (delta) {
        await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: delta } } });
        await tx.loyaltyTransaction.create({ data: { userId: order.userId, orderId: order.id, points: delta, type: delta > 0 ? 'earned' : 'reversed', description: `Payment adjustment for ${order.orderNumber}`, dedupKey: `order-${order.id}-refund-${refund}` } });
      }
      if (firstPayment) for (const item of order.items) {
        if (!item.productId) continue;
        const where = { userId: order.userId, productId: item.productId, size: item.size ?? '', color: item.color ?? '' };
        const removed = await tx.cartItem.deleteMany({ where: { ...where, quantity: { lte: item.quantity } } });
        if (!removed.count) await tx.cartItem.updateMany({ where: { ...where, quantity: { gt: item.quantity } }, data: { quantity: { decrement: item.quantity } } });
      }
    }
    if (firstPayment) {
      const user = order.userId ? await tx.user.findUnique({ where: { id: order.userId } }) : null;
      const address = order.shippingAddress as Record<string, string>;
      const email = order.guestEmail ?? user?.email;
      if (email) await enqueueEmail(tx, orderConfirmationPayload({
        locale: order.locale === 'fr' ? 'fr' : 'en',
        orderId: order.id, orderNumber: order.orderNumber ?? order.id, customerEmail: email,
        customerName: `${address.firstName ?? ''} ${address.lastName ?? ''}`.trim(),
        items: order.items.map((i) => ({ name: i.productName, quantity: i.quantity, unitPriceCents: i.unitPriceCents, size: i.size ?? undefined, color: i.color ?? undefined })),
        subtotalCents: order.totalCents - order.shippingCents + order.discountCents,
        shippingCents: order.shippingCents, discountCents: order.discountCents, totalCents: order.totalCents,
        couponCode: order.couponCode, shippingAddress: { city: address.city, province: address.province, country: address.country },
      }), `order-confirmation-${order.id}`);
    }
  }
}
