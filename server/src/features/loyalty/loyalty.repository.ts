import { prisma } from '../../core/database/client';
import type { LoyaltyTransactionType, LoyaltyTransactionQueryParams } from './loyalty.types';

interface CreateTransactionData {
  userId: string;
  points: number;
  type: LoyaltyTransactionType;
  description: string;
  orderId?: string | null;
}

export class LoyaltyRepository {
  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });
    return user?.loyaltyPoints ?? 0;
  }

  async getTransactions(userId: string, params: LoyaltyTransactionQueryParams) {
    const { page = 1, perPage = 20 } = params;
    const skip = (page - 1) * perPage;

    const [items, totalItems] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.loyaltyTransaction.count({ where: { userId } }),
    ]);

    return {
      items,
      totalItems,
      page,
      perPage,
      totalPages: Math.ceil(totalItems / perPage),
    };
  }

  /**
   * Award or deduct points within a transaction to keep the balance consistent
   * with the transaction history. Uses a serializable approach: update the user
   * balance and create the transaction record atomically.
   */
  async createTransaction(data: CreateTransactionData) {
    return prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: data.userId },
        data: { loyaltyPoints: { increment: data.points } },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          userId: data.userId,
          points: data.points,
          type: data.type,
          description: data.description,
          orderId: data.orderId ?? null,
        },
      });

      return transaction;
    });
  }

  /**
   * Check whether points were already awarded for a specific order,
   * preventing duplicate awards on webhook retries.
   */
  async hasEarnedForOrder(userId: string, orderId: string): Promise<boolean> {
    const existing = await prisma.loyaltyTransaction.findFirst({
      where: {
        userId,
        orderId,
        type: 'earned',
      },
    });
    return existing !== null;
  }
}
