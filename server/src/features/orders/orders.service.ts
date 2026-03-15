import { SpanStatusCode } from '@opentelemetry/api';
import { NotFoundError, ForbiddenError, ValidationError } from '../../core/errors/http.errors';
import { OrdersRepository } from './orders.repository';
import { CartRepository } from '../cart/cart.repository';
import { CouponsService } from '../coupons/coupons.service';
import { VariantsRepository } from '../products/variants.repository';
import { OrderResponse, OrderItemResponse, CreateOrderDto, OrderQueryParams } from './orders.types';
import { enqueueOrderConfirmationEmail } from '../../core/queue/email.producer';
import { logger } from '../../core/observability/logger';
import { getTracer } from '../../core/observability/tracer';

// Only forward transitions are allowed to prevent inconsistent order states
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  paid: ['confirmed', 'cancelled', 'refunded'],
  cancelled: [],
  refunded: [],
};

export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly cartRepository: CartRepository,
    private readonly couponsService: CouponsService,
    private readonly variantsRepository: VariantsRepository = new VariantsRepository(),
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderResponse> {
    const tracer = getTracer('orders-service');
    const span = tracer.startSpan('createOrder', {
      attributes: { 'order.userId': userId },
    });

    try {
    const cartItems = await this.cartRepository.findByUserId(userId);

    if (cartItems.length === 0) {
      throw new ValidationError('Cannot create an order with an empty cart.');
    }

    // Verify all products are still active
    const inactiveProducts = cartItems.filter((item) => !item.product.isActive);
    if (inactiveProducts.length > 0) {
      const names = inactiveProducts.map((item) => item.product.name).join(', ');
      throw new ValidationError(
        `The following products are no longer available: ${names}.`,
      );
    }

    // Verify stock availability for each cart item
    for (const item of cartItems) {
      if (item.size && item.color) {
        const variant = await this.variantsRepository.findByProductAndVariant(
          item.productId,
          item.size,
          item.color,
        );
        if (variant && variant.stock < item.quantity) {
          throw new ValidationError(
            `Insufficient stock for "${item.product.name}" (${item.size}/${item.color}). Only ${variant.stock} remaining.`,
          );
        }
      }
    }

    const subtotalCents = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    // Apply coupon if provided
    let discountCents = 0;
    let couponCode: string | null = null;

    if (dto.couponCode) {
      const couponResult = await this.couponsService.applyCoupon(dto.couponCode, subtotalCents);
      discountCents = couponResult.discountCents;
      couponCode = couponResult.coupon.code;
    }

    const totalCents = Math.max(subtotalCents - discountCents, 0);

    const shippingAddress = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      postalCode: dto.postalCode,
      province: dto.province,
      country: dto.country,
    };

    const orderItems = cartItems.map((item) => ({
      productId: item.productId,
      productKey: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceCents: item.product.price,
      size: item.size,
      color: item.color,
    }));

    const order = await this.ordersRepository.create({
      userId,
      totalCents,
      discountCents,
      couponCode,
      shippingAddress,
      items: orderItems,
    });

    // Decrement stock for each ordered variant
    for (const item of cartItems) {
      if (item.size && item.color) {
        try {
          await this.variantsRepository.decrementStock(
            item.productId,
            item.size,
            item.color,
            item.quantity,
          );
        } catch (err) {
          logger.warn(
            { err, productId: item.productId, size: item.size, color: item.color },
            'Could not decrement variant stock (variant may not exist)',
          );
        }
      }
    }

    // Clear the cart after successful order creation
    await this.cartRepository.clearCart(userId);

    // Record initial status history
    await this.ordersRepository.createStatusHistoryEntry(order.id, 'pending', 'Order placed');

    const orderResponse = this.toOrderResponse(order);

    span.setAttributes({
      'order.totalCents': totalCents,
      'order.itemCount': cartItems.length,
      'order.id': order.id,
    });

    // Enqueue order confirmation email (falls back to direct send if Redis is unavailable)
    enqueueOrderConfirmationEmail({
      orderId: order.id,
      customerEmail: '',
      customerName: `${dto.firstName} ${dto.lastName}`,
      items: orderItems.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        size: item.size ?? undefined,
        color: item.color ?? undefined,
      })),
      subtotalCents,
      discountCents,
      couponCode,
      totalCents,
      shippingAddress: {
        city: dto.city,
        province: dto.province,
        country: dto.country,
      },
    }).catch((err) => {
      logger.error({ err, orderId: order.id }, 'Failed to enqueue order confirmation email');
    });

    span.setStatus({ code: SpanStatusCode.OK });
    return orderResponse;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
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
    const order = await this.ordersRepository.findById(orderId);

    if (!order) {
      throw new NotFoundError('Order', orderId);
    }

    const allowedNext = VALID_STATUS_TRANSITIONS[order.status];
    if (allowedNext && !allowedNext.includes(status)) {
      throw new ValidationError(
        `Cannot transition order from '${order.status}' to '${status}'. Allowed transitions: ${allowedNext.join(', ') || 'none'}.`,
      );
    }

    const updated = await this.ordersRepository.updateStatus(orderId, status);

    await this.ordersRepository.createStatusHistoryEntry(orderId, status, note);

    logger.info({ orderId, from: order.status, to: status }, 'Order status updated');

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
    userId: string;
    totalCents: number;
    discountCents: number;
    couponCode: string | null;
    status: string;
    transactionKey: string | null;
    shippingAddress: unknown;
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
      userId: order.userId,
      totalCents: order.totalCents,
      discountCents: order.discountCents,
      couponCode: order.couponCode,
      status: order.status,
      transactionKey: order.transactionKey,
      shippingAddress: order.shippingAddress as Record<string, unknown> | null,
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
