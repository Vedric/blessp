import { prisma } from '../../core/database/client';

export interface UpdateVariantInput {
  size: string;
  color: string;
  stock: number;
  sku?: string | null;
}

export class VariantsRepository {
  async findByProductId(productId: string) {
    return prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ color: 'asc' }, { size: 'asc' }],
    });
  }

  async findByProductAndVariant(productId: string, size: string, color: string) {
    return prisma.productVariant.findUnique({
      where: {
        productId_size_color: { productId, size, color },
      },
    });
  }

  async upsertMany(productId: string, variants: UpdateVariantInput[]) {
    return prisma.$transaction(
      variants.map((v) =>
        prisma.productVariant.upsert({
          where: {
            productId_size_color: {
              productId,
              size: v.size,
              color: v.color,
            },
          },
          update: {
            stock: v.stock,
            sku: v.sku ?? undefined,
          },
          create: {
            productId,
            size: v.size,
            color: v.color,
            stock: v.stock,
            sku: v.sku ?? null,
          },
        }),
      ),
    );
  }

  async decrementStock(productId: string, size: string, color: string, quantity: number) {
    return prisma.productVariant.update({
      where: {
        productId_size_color: { productId, size, color },
      },
      data: {
        stock: { decrement: quantity },
      },
    });
  }
}
