import { Prisma } from '@prisma/client';
import { prisma } from '../../core/database/client';
import { OrderQueryParams } from './orders.types';

interface CreateOrderData {
  userId: string;
  totalCents: number;
  discountCents?: number;
  couponCode?: string | null;
  shippingAddress: Record<string, unknown>;
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

export class OrdersRepository {
  async create(data: CreateOrderData) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: data.userId,
          totalCents: data.totalCents,
          discountCents: data.discountCents ?? 0,
          couponCode: data.couponCode ?? null,
          shippingAddress: data.shippingAddress as Prisma.InputJsonValue,
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
