import { z } from 'zod';
import { type Order, type OrderItem, type Prisma } from '@prisma/client';
import { Env } from '../../core/config/env';
import { prisma } from '../../core/database/client';
import { transaction as transact, lockResource } from '../../core/database/transaction';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/http.errors';
import { paypalGateway, paypalCents, type PaypalOrder, type PaypalRefund } from './paypal.gateway';

type FullOrder = Order & { items: OrderItem[] };
type Settle = (tx: Prisma.TransactionClient, order: FullOrder, refund?: number) => Promise<void>;
const id = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);
// A webhook may read both the order and refund; each provider call has its
// own short timeout. Leave enough time for token renewal and two reads.
const transaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => transact(work, 30000);

export class PaypalService {
  constructor(private readonly settle: Settle) {}

  private authorize(order: Order, userId: string | null, email?: string): void {
    if (order.userId !== userId || (!userId && order.guestEmail !== email?.trim().toLowerCase())) throw new ForbiddenError('You do not have access to this order.');
  }
  private payable(order: Order): void {
    if (order.status !== 'pending' || order.paymentStatus !== 'pending' || order.stockReleasedAt || (order.expiresAt && order.expiresAt <= new Date())) throw new ValidationError('This reservation is no longer payable. Start a new checkout.');
  }
  private validate(order: Order, remote: PaypalOrder): void {
    const units = remote.purchase_units;
    if (remote.id !== order.transactionKey || units?.length !== 1 || units[0].custom_id !== order.id || paypalCents(units[0].amount) !== order.totalCents) throw new ValidationError('PayPal order binding or amount mismatch.');
  }
  private async remote(order: Order): Promise<PaypalOrder> {
    if (order.paymentProvider !== 'paypal' || !order.transactionKey) throw new ValidationError('No PayPal payment is associated with this order.');
    const remote = await paypalGateway.request<PaypalOrder>(`/v2/checkout/orders/${id.parse(order.transactionKey)}`);
    this.validate(order, remote);
    return remote;
  }

  async create(orderId: string, userId: string | null, email?: string): Promise<{ approvalUrl: string }> {
    return transaction(async tx => {
      await lockResource(tx, `order:${orderId}`);
      let order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError('Order', orderId);
      this.authorize(order, userId, email); this.payable(order);
      if (order.transactionKey && order.paymentProvider !== 'paypal') throw new ConflictError('Cancel the existing payment before changing provider.');
      let remote: PaypalOrder;
      if (order.transactionKey) remote = await this.remote(order);
      else {
        const address = order.shippingAddress as Record<string, string>;
        remote = await paypalGateway.request<PaypalOrder>('/v2/checkout/orders', 'POST', {
          intent: 'CAPTURE',
          purchase_units: [{ custom_id: order.id, amount: { currency_code: 'CAD', value: (order.totalCents / 100).toFixed(2) },
            shipping: { name: { full_name: `${address.firstName} ${address.lastName}` }, address: {
              address_line_1: address.addressLine1, ...(address.addressLine2 ? { address_line_2: address.addressLine2 } : {}),
              admin_area_2: address.city, ...(address.province ? { admin_area_1: address.province } : {}), postal_code: address.postalCode, country_code: address.country,
            } },
          }],
          payment_source: { paypal: { experience_context: { user_action: 'PAY_NOW', shipping_preference: 'SET_PROVIDED_ADDRESS',
            return_url: `${Env.CLIENT_URL}/checkout?paypal=return`, cancel_url: `${Env.CLIENT_URL}/checkout?paypal=cancel`,
          } } },
        }, order.id);
        id.parse(remote.id);
        order = await tx.order.update({ where: { id: orderId }, data: { paymentProvider: 'paypal', transactionKey: remote.id } });
        this.validate(order, remote);
      }
      const link = remote.links?.find(link => link.rel === 'payer-action' || link.rel === 'approve');
      if (!link) throw new ValidationError('PayPal approval is unavailable. Check your order status.');
      const url = new URL(link.href);
      const host = Env.PAYPAL_ENVIRONMENT === 'live' ? 'www.paypal.com' : 'www.sandbox.paypal.com';
      if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.port) throw new Error('Invalid PayPal approval URL.');
      return { approvalUrl: url.href };
    });
  }

  async capture(orderId: string, userId: string | null, email?: string): Promise<{ paymentStatus: string }> {
    // Commit a durable marker BEFORE the external capture. On timeout, expiry
    // must retain the stock until reconciliation establishes a terminal outcome.
    await transaction(async tx => {
      await lockResource(tx, `order:${orderId}`);
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError('Order', orderId);
      this.authorize(order, userId, email);
      if (order.paymentProvider !== 'paypal' || !order.transactionKey) throw new ValidationError('No PayPal payment is associated with this order.');
      if (order.paymentStatus !== 'pending') return;
      if (!order.paypalCaptureRequestedAt) {
        this.payable(order);
        const remote = await this.remote(order);
        if (remote.status !== 'APPROVED') throw new ValidationError('Approve the payment in PayPal first.');
        await tx.order.update({ where: { id: orderId }, data: { paypalCaptureRequestedAt: new Date() } });
      }
    });
    return transaction(async tx => {
      await lockResource(tx, `order:${orderId}`);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      if (order.paymentStatus !== 'pending') return { paymentStatus: order.paymentStatus };
      let remote = await this.remote(order);
      if (remote.status === 'APPROVED' && !remote.purchase_units?.[0].payments?.captures?.length) {
        // PayPal's default request-id retention is finite. Don't issue a fresh
        // capture after its window when the first result is still uncertain.
        if (!order.paypalCaptureRequestedAt || Date.now() - order.paypalCaptureRequestedAt.getTime() > 5 * 3600000) throw new ConflictError('Payment requires reconciliation by support.');
        remote = await paypalGateway.request<PaypalOrder>(`/v2/checkout/orders/${id.parse(order.transactionKey)}/capture`, 'POST', {}, `c-${order.id}`);
      }
      await this.reconcile(tx, order, remote);
      return { paymentStatus: (await tx.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus };
    });
  }

  private async reconcile(tx: Prisma.TransactionClient, order: FullOrder, remote: PaypalOrder): Promise<boolean> {
    this.validate(order, remote);
    const captures = remote.purchase_units?.[0].payments?.captures ?? [];
    if (!captures.length) return false;
    if (captures.length !== 1 || paypalCents(captures[0].amount) !== order.totalCents) throw new ValidationError('PayPal capture amount mismatch.');
    const capture = captures[0]; id.parse(capture.id);
    if (order.paypalCaptureId && order.paypalCaptureId !== capture.id) throw new ValidationError('PayPal capture binding mismatch.');
    await tx.order.update({ where: { id: order.id }, data: { paypalCaptureId: capture.id } });
    if (['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(capture.status)) {
      await this.settle(tx, order, capture.status === 'REFUNDED' ? order.totalCents : order.refundedCents);
      return true;
    }
    return false;
  }

  async beforeCancel(tx: Prisma.TransactionClient, order: FullOrder): Promise<'paid' | 'cancelled'> {
    const remote = await this.remote(order);
    if (await this.reconcile(tx, order, remote)) return 'paid';
    const capture = remote.purchase_units?.[0].payments?.captures?.[0];
    if ((order.paypalCaptureRequestedAt || capture) && capture?.status !== 'DECLINED' && capture?.status !== 'FAILED') throw new ConflictError('PayPal is still being reconciled. Stock remains reserved; retry later or contact support.');
    // An approval cannot charge independently: capture is server-side and uses
    // this same order lock. A later capture request sees the cancelled order.
    return 'cancelled';
  }

  async refund(orderId: string, expected?: number): Promise<{ refundId: string; amountRefunded: number }> {
    return transaction(async tx => {
      await lockResource(tx, `order:${orderId}`);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      if (expected !== undefined && expected !== order.refundedCents) throw new ConflictError('Refund balance changed. Reload the order before requesting a refund.');
      if (!['paid', 'partially_refunded'].includes(order.paymentStatus) || !order.paypalCaptureId) throw new ValidationError('Only captured payments can be refunded.');
      const pending = await tx.paypalRefund.findFirst({ where: { orderId, status: 'PENDING' } });
      const refund = pending
        ? await paypalGateway.request<PaypalRefund>(`/v2/payments/refunds/${id.parse(pending.id)}`)
        : await paypalGateway.request<PaypalRefund>(`/v2/payments/captures/${id.parse(order.paypalCaptureId)}/refund`, 'POST', {}, `r-${order.id}`);
      await this.recordRefund(tx, order, refund);
      return { refundId: refund.id, amountRefunded: paypalCents(refund.amount) };
    });
  }

  private async recordRefund(tx: Prisma.TransactionClient, order: FullOrder, refund: PaypalRefund): Promise<void> {
    id.parse(refund.id);
    const cents = paypalCents(refund.amount);
    if (cents > order.totalCents || !['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(refund.status)) throw new ValidationError('Invalid PayPal refund.');
    const prior = await tx.paypalRefund.findUnique({ where: { id: refund.id } });
    if (prior && (prior.orderId !== order.id || prior.amountCents !== cents)) throw new ValidationError('PayPal refund binding mismatch.');
    // Never let an out-of-order pending/failed notification undo a completed refund.
    await tx.paypalRefund.upsert({ where: { id: refund.id }, create: { id: refund.id, orderId: order.id, amountCents: cents, status: refund.status }, update: { status: prior?.status === 'COMPLETED' ? 'COMPLETED' : refund.status } });
    const sum = await tx.paypalRefund.aggregate({ where: { orderId: order.id, status: 'COMPLETED' }, _sum: { amountCents: true } });
    const refunded = Math.max(order.refundedCents, sum._sum.amountCents ?? 0);
    if (refunded > order.totalCents) throw new ValidationError('PayPal refunds exceed the order total.');
    await this.settle(tx, order, refunded);
  }

  async webhook(headers: Record<string, string | string[] | undefined>, body: unknown): Promise<void> {
    await paypalGateway.verify(headers, body);
    const event = z.object({ event_type: z.string(), resource: z.object({ id }).passthrough() }).parse(body);
    if (!['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.PENDING', 'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED'].includes(event.event_type)) return;
    const resource = event.resource as { id: string; supplementary_data?: { related_ids?: { order_id?: string } }; links?: Array<{ rel: string; href: string }> };
    let order: Order | null;
    if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
      const up = resource.links?.find(link => link.rel === 'up');
      const captureId = up && new URL(up.href).pathname.match(/^\/v2\/payments\/captures\/([A-Za-z0-9-]+)$/)?.[1];
      if (!captureId) throw new ValidationError('Missing PayPal refund capture reference.');
      order = await prisma.order.findUnique({ where: { paypalCaptureId: captureId } });
    } else {
      const remoteId = resource.supplementary_data?.related_ids?.order_id;
      order = remoteId ? await prisma.order.findUnique({ where: { transactionKey: remoteId } }) : null;
    }
    // Retry: the event can precede the local binding transaction committing.
    if (!order || order.paymentProvider !== 'paypal') throw new ConflictError('PayPal order binding is not available yet.');
    await transaction(async tx => {
      await lockResource(tx, `order:${order.id}`);
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
      await this.reconcile(tx, fresh, await this.remote(fresh));
      if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
        const refund = await paypalGateway.request<PaypalRefund>(`/v2/payments/refunds/${id.parse(resource.id)}`);
        if (refund.id !== resource.id) throw new ValidationError('PayPal refund binding mismatch.');
        const updated = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
        await this.recordRefund(tx, updated, refund);
      }
    });
  }
}
