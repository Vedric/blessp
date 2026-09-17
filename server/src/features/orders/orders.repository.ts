import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../core/database/client';
import { OrderQueryParams } from './orders.types';

interface CreateOrderData {
  userId: string | null;
  guestEmail?: string | null;
  totalCents: number;
  shippingCents?: number;
  discountCents?: number;
  couponCode?: string | null;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown> | null;
  items: Array<{
    productId: string | null;
    productKey: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    size: string | null;
    color: string | null;
  }>;
}

/**
 * Generates a human-friendly order number of the form BLP-YYYYMMDD-XXXXXX.
 * The last segment is six crypto-strong base32 characters, giving ~1 billion
 * combinations per day with a negligible collision rate; the unique index on
 * Order.order_number catches any unlikely collision.
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const ymd =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L confusion
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (const byte of bytes) {
    suffix += alphabet[byte % alphabet.length];
  }
  return `BLP-${ymd}-${suffix}`;
}

export class OrdersRepository {
  async create(data: CreateOrderData) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: data.userId,
          guestEmail: data.guestEmail ?? null,
          orderNumber: generateOrderNumber(),
          totalCents: data.totalCents,
          shippingCents: data.shippingCents ?? 0,
          discountCents: data.discountCents ?? 0,
          couponCode: data.couponCode ?? null,
          shippingAddress: data.shippingAddress as Prisma.InputJsonValue,
          billingAddress: data.billingAddress
            ? (data.billingAddress as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              productKey: item.productKey,
              productName: item.productName,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              size: item.size,
              color: item.color,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return order;
    });
  }

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
  }

  /**
   * Looks up a guest order by the human-readable orderNumber plus the
   * email used at checkout. Returns null when either does not match.
   * Used by the guest order-status page: the orderNumber alone is not
   * enough because it appears on receipts and could be shoulder-surfed.
   */
  async findGuestByOrderNumberAndEmail(orderNumber: string, email: string) {
    return prisma.order.findFirst({
      where: {
        orderNumber,
        guestEmail: email,
        userId: null,
      },
      include: { items: true },
    });
  }

  async findByUserId(userId: string, params: OrderQueryParams) {
    const { page = 1, perPage = 20, status } = params;
    const skip = (page - 1) * perPage;

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      items,
      totalItems,
      page,
      perPage,
      totalPages: Math.ceil(totalItems / perPage),
    };
  }

  async findAll(params: OrderQueryParams) {
    const { page = 1, perPage = 20, status } = params;
    const skip = (page - 1) * perPage;

    const where: Prisma.OrderWhereInput = {
      ...(status && { status }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      items,
      totalItems,
      page,
      perPage,
      totalPages: Math.ceil(totalItems / perPage),
    };
  }

  async updateStatus(id: string, status: string) {
    return prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
  }

  async updateTransactionKey(id: string, transactionKey: string) {
    return prisma.order.update({
      where: { id },
      data: { transactionKey },
    });
  }

  async createStatusHistoryEntry(orderId: string, status: string, note?: string) {
    return prisma.orderStatusHistory.create({
      data: { orderId, status, note },
    });
  }

  async findStatusHistory(orderId: string) {
    return prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
