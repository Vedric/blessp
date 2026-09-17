import { prisma } from '../../core/database/client';

export class CouponsRepository {
  async findByCode(code: string) {
    return prisma.coupon.findUnique({
      where: { code },
    });
  }

  async findById(id: string) {
    return prisma.coupon.findUnique({
      where: { id },
    });
  }

  async findAll() {
    return prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    code: string;
    discountType: string;
    discountValue: number;
    minOrderCents?: number;
    maxUses?: number;
    expiresAt?: Date;
  }) {
    return prisma.coupon.create({
      data: {
        code: data.code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderCents: data.minOrderCents ?? null,
        maxUses: data.maxUses ?? null,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  async update(id: string, data: {
    isActive?: boolean;
    maxUses?: number | null;
    expiresAt?: Date | null;
  }) {
    return prisma.coupon.update({
      where: { id },
      data,
    });
  }

  async incrementUses(id: string) {
    return prisma.coupon.update({
      where: { id },
      data: {
        currentUses: { increment: 1 },
      },
    });
  }
}
