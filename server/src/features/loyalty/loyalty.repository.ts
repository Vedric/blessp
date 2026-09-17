import crypto from 'node:crypto';
import { transaction, lockResource } from '../../core/database/transaction';
import { ValidationError } from '../../core/errors/http.errors';
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
  async redeem(data: CreateTransactionData & { discountCents: number }) {
    return transaction(async (tx) => {
      await lockResource(tx, `loyalty:${data.userId}`);
      const debited = await tx.user.updateMany({ where: { id: data.userId, loyaltyPoints: { gte: -data.points } }, data: { loyaltyPoints: { increment: data.points } } });
      if (debited.count !== 1) throw new ValidationError('Insufficient loyalty points.');
      const code = `LOYALTY-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
      await tx.coupon.create({ data: { code, userId: data.userId, discountType: 'fixed', discountValue: data.discountCents, maxUses: 1, campaign: 'loyalty' } });
      return tx.loyaltyTransaction.create({ data: { userId: data.userId, points: data.points, type: 'redeemed', description: data.description, couponCode: code } });
    });
  }

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
    return transaction(async (tx) => {
      await lockResource(tx, `loyalty:${data.userId}`);
      if (data.orderId && data.type === 'earned') {
        const existing = await tx.loyaltyTransaction.findUnique({ where: { dedupKey: `earned-${data.orderId}` } });
        if (existing) return existing;
      }
      await tx.user.update({
        where: { id: data.userId },
        data: { loyaltyPoints: { increment: data.points } },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          dedupKey: data.orderId && data.type === 'earned' ? `earned-${data.orderId}` : null,
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
