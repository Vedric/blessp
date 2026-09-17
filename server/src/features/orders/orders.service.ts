import crypto from 'node:crypto';
import { quoteShipping } from '../commerce/commerce.service';
import { Prisma, type Order, type OrderItem } from '@prisma/client';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../core/errors/http.errors';
import { OrdersRepository, generateOrderNumber } from './orders.repository';
import { CartRepository } from '../cart/cart.repository';
import { CouponsService } from '../coupons/coupons.service';
import { VariantsRepository } from '../products/variants.repository';
import { OrderResponse, OrderItemResponse, CreateOrderDto, OrderQueryParams } from './orders.types';
import { transaction, lockResource } from '../../core/database/transaction';

interface GuestOrderDto extends CreateOrderDto {
  email: string;
  items: Array<{ productId: string; quantity: number; size?: string; color?: string }>;
}

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['cancelled'], paid: ['confirmed'], confirmed: ['processing'],
  processing: ['shipped'], shipped: ['delivered'], delivered: [], cancelled: [], refunded: [],
};

/** Caller holds the order lock. A reservation is returned at most once. */
export async function releaseReservation(tx: Prisma.TransactionClient, order: Order & { items: OrderItem[] }): Promise<void> {
  if (order.stockReleasedAt || order.paymentStatus !== 'pending') return;
  if (!order.checkoutKey || !order.expiresAt) throw new ValidationError('Legacy order inventory must be reconciled manually before cancellation.');
  for (const item of [...order.items].sort((a, b) => `${a.productId}/${a.size}/${a.color}`.localeCompare(`${b.productId}/${b.size}/${b.color}`))) {
    if (item.productId) await tx.productVariant.updateMany({ where: { productId: item.productId, size: item.size ?? '', color: item.color ?? '' }, data: { stock: { increment: item.quantity } } });
  }
  if (order.couponReserved && order.couponCode) await tx.coupon.updateMany({ where: { code: order.couponCode, currentUses: { gt: 0 } }, data: { currentUses: { decrement: 1 } } });
  await tx.order.update({ where: { id: order.id }, data: { stockReleasedAt: new Date(), couponReserved: false, status: 'cancelled' } });
}

export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly cartRepository: CartRepository,
    private readonly couponsService: CouponsService,
    private readonly variantsRepository: VariantsRepository = new VariantsRepository(),
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderResponse> {
    return this.placeOrder(userId, dto);
  }

  async createGuestOrder(dto: GuestOrderDto): Promise<OrderResponse> {
    return this.placeOrder(null, dto);
  }

  private async placeOrder(userId: string | null, dto: CreateOrderDto | GuestOrderDto): Promise<OrderResponse> {
    const checkoutKey = dto.checkoutKey ?? crypto.randomUUID();
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ userId, ...dto })).digest('hex');
    const order = await transaction(async (tx) => {
      await lockResource(tx, `checkout:${checkoutKey}`);
      const prior = await tx.order.findUnique({ where: { checkoutKey }, include: { items: true } });
      if (prior) {
        if (prior.userId !== userId || prior.requestHash !== requestHash) throw new ConflictError('Checkout key already used for different details.');
        if (prior.status === 'cancelled') throw new ConflictError('Reservation expired. Start a new checkout.');
        return prior;
      }
      // Validate the destination before reserving stock or consuming a coupon.
      quoteShipping(dto.country, 0);
      const cart = userId
        ? await tx.cartItem.findMany({ where: { userId } })
        : (dto as GuestOrderDto).items;
      if (!cart?.length) throw new ValidationError('Cannot create an order with an empty cart.');
      // Aggregate duplicates before checking or decrementing stock.
      const lines = new Map<string, { productId: string; quantity: number; size: string; color: string }>();
      for (const item of cart) {
        if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new ValidationError('Invalid item quantity.');
        const line = { productId: item.productId, quantity: item.quantity, size: item.size ?? '', color: item.color ?? '' };
        const key = JSON.stringify([line.productId, line.size, line.color]);
        const previous = lines.get(key);
        line.quantity += previous?.quantity ?? 0;
        if (line.quantity > 100) throw new ValidationError('Maximum quantity is 100 per variant.');
        lines.set(key, line);
      }
      const items = [];
      for (const [, line] of [...lines.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const product = await tx.product.findUnique({ where: { id: line.productId, isActive: true, deletedAt: null } });
        if (!product) throw new ValidationError('One or more products are unavailable.');
        if ((product.sizes.length && !product.sizes.includes(line.size)) || (product.colors.length && !product.colors.includes(line.color))) throw new ValidationError('Select a valid size and color.');
        const reserved = await tx.productVariant.updateMany({ where: { productId: line.productId, size: line.size, color: line.color, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } } });
        if (reserved.count !== 1) throw new ValidationError(`Insufficient stock or invalid variant for "${product.name}".`);
        items.push({ ...line, productKey: product.id, productName: product.name, unitPriceCents: product.price });
      }
      const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
      let discountCents = 0;
      let couponCode: string | null = null;
      if (dto.couponCode) {
        couponCode = dto.couponCode.toUpperCase();
        await lockResource(tx, `coupon:${couponCode}`);
        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
        if (!coupon || !coupon.isActive || (coupon.userId && coupon.userId !== userId) || (coupon.expiresAt && coupon.expiresAt <= new Date()) || (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) || (coupon.minOrderCents !== null && subtotal < coupon.minOrderCents)) throw new ValidationError('Coupon is unavailable for this order.');
        discountCents = Math.min(subtotal, coupon.discountType === 'percentage' ? Math.round(subtotal * coupon.discountValue / 100) : coupon.discountValue);
        await tx.coupon.update({ where: { id: coupon.id }, data: { currentUses: { increment: 1 } } });
      }
      const shippingCents = quoteShipping(dto.country, subtotal - discountCents);
      const { firstName, lastName, phone, addressLine1, addressLine2, city, postalCode, province, country } = dto;
      return tx.order.create({ data: {
        locale: dto.locale ?? 'en',
        userId, guestEmail: userId ? null : (dto as GuestOrderDto).email.toLowerCase(),
        checkoutKey, requestHash, orderNumber: generateOrderNumber(), totalCents: subtotal - discountCents + shippingCents,
        discountCents, shippingCents, couponCode, couponReserved: !!couponCode, expiresAt: new Date(Date.now() + 30 * 60000),
        shippingAddress: { firstName, lastName, phone, addressLine1, addressLine2, city, postalCode, province, country },
        billingAddress: dto.billingAddress ?? Prisma.JsonNull,
        items: { create: items }, statusHistory: { create: { status: 'pending', note: 'Inventory reserved for 30 minutes; payment pending.' } },
      }, include: { items: true } });
    });
    return this.toOrderResponse(order);
  }

  /**
   * Public endpoint for guests to retrieve their order using the order
   * number printed on their receipt plus the email they used at checkout.
   * Returns 404 to avoid leaking which of the two fields is wrong.
   */
  async lookupGuestOrder(orderNumber: string, email: string): Promise<OrderResponse> {
    const order = await this.ordersRepository.findGuestByOrderNumberAndEmail(orderNumber, email);
    if (!order) {
      throw new NotFoundError('Order', orderNumber);
    }
    return this.toOrderResponse(order);
  }

  async getOrder(userId: string, orderId: string, isAdmin: boolean): Promise<OrderResponse> {
    const order = await this.ordersRepository.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    // Ownership check: only the order owner or an admin can access
    if (order.userId !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have access to this order.');
    }

    return this.toOrderResponse(order);
  }

  async getUserOrders(userId: string, params: OrderQueryParams) {
    const result = await this.ordersRepository.findByUserId(userId, params);

    return {
      data: result.items.map(this.toOrderResponse),
      pagination: {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    };
  }

  async getAllOrders(params: OrderQueryParams) {
    const result = await this.ordersRepository.findAll(params);

    return {
      data: result.items.map(this.toOrderResponse),
      pagination: {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    };
  }

  async updateOrderStatus(orderId: string, status: string, note?: string): Promise<OrderResponse> {
    if (['paid', 'refunded', 'pending'].includes(status)) throw new ValidationError('Payment states can only be changed by verified payment events.');
    const updated = await transaction(async (tx) => {
      await lockResource(tx, `order:${orderId}`);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundError('Order', orderId);
      if (!VALID_STATUS_TRANSITIONS[order.status]?.includes(status)) throw new ValidationError(`Cannot transition order from '${order.status}' to '${status}'.`);
      if (status === 'cancelled') {
        if (order.paymentStatus !== 'pending' || order.transactionKey) throw new ValidationError('Cancel the payment through the payments cancellation endpoint before releasing stock. Paid orders must be refunded.');
        await releaseReservation(tx, order);
      } else if (!['paid', 'partially_refunded'].includes(order.paymentStatus)) {
        throw new ValidationError('Only paid orders can enter fulfillment.');
      }
      await tx.orderStatusHistory.create({ data: { orderId, status, note } });
      return tx.order.update({ where: { id: orderId }, data: { status }, include: { items: true } });
    });
    return this.toOrderResponse(updated);
  }

  async getOrderTimeline(userId: string, orderId: string, isAdmin: boolean) {
    const order = await this.ordersRepository.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    if (order.userId !== userId && !isAdmin) {
      throw new ForbiddenError('You do not have access to this order.');
    }

    return this.ordersRepository.findStatusHistory(orderId);
  }

  private toOrderResponse(order: {
    id: string;
    orderNumber?: string | null;
    userId: string | null;
    guestEmail?: string | null;
    totalCents: number;
    shippingCents: number;
    discountCents: number;
    couponCode: string | null;
    status: string;
    paymentStatus?: string;
    paymentProvider?: string;
    refundedCents?: number;
    expiresAt?: Date | null;
    transactionKey: string | null;
    shippingAddress: unknown;
    billingAddress?: unknown;
    items: Array<{
      id: string;
      productId: string | null;
      productKey: string;
      productName: string;
      quantity: number;
      unitPriceCents: number;
      size: string | null;
      color: string | null;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): OrderResponse {
    return {
      id: order.id,
      orderNumber: order.orderNumber ?? null,
      userId: order.userId,
      guestEmail: order.guestEmail ?? null,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
      discountCents: order.discountCents,
      couponCode: order.couponCode,
      status: order.status,
      paymentStatus: order.paymentStatus ?? 'pending',
      paymentProvider: order.paymentProvider ?? 'stripe',
      refundedCents: order.refundedCents ?? 0,
      expiresAt: order.expiresAt ?? null,
      transactionKey: order.transactionKey,
      shippingAddress: order.shippingAddress as Record<string, unknown> | null,
      billingAddress: (order.billingAddress ?? null) as Record<string, unknown> | null,
      items: order.items.map((item): OrderItemResponse => ({
        id: item.id,
        productId: item.productId,
        productKey: item.productKey,
        productName: item.productName,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        size: item.size,
        color: item.color,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
