import { prisma } from '../../core/database/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/http.errors';

export interface UpdateVariantInput {
  size: string;
  color: string;
  stock: number;
  expectedStock?: number;
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

  async upsertMany(productId: string, variants: UpdateVariantInput[], actorId?: string) {
    return transaction(async tx => {
      await lockResource(tx, `inventory-product:${productId}`);
      const product = await tx.product.findFirst({ where: { id: productId, deletedAt: null } });
      if (!product) throw new NotFoundError('Product', productId);
      const seen = new Set<string>();
      for (const v of [...variants].sort((a, b) => JSON.stringify([a.size, a.color]).localeCompare(JSON.stringify([b.size, b.color])))) {
        const key = JSON.stringify([v.size, v.color]);
        if (seen.has(key)) throw new ValidationError('Duplicate variant.');
        seen.add(key);
        if (!(product.sizes.length ? product.sizes : ['']).includes(v.size) || !(product.colors.length ? product.colors : ['']).includes(v.color)) throw new ValidationError('Variant must match the product sizes and colors.');
        const existing = await tx.productVariant.findUnique({ where: { productId_size_color: { productId, size: v.size, color: v.color } } });
        if (existing && v.expectedStock === undefined) throw new ConflictError('Expected stock is required when updating an existing variant.');
        if (existing && existing.stock !== v.expectedStock) throw new ConflictError('Stock changed. Reload the current quantity before saving.');
        let variantId: string;
        if (existing) {
          const updated = await tx.productVariant.updateMany({ where: { id: existing.id, stock: v.expectedStock }, data: { stock: v.stock, sku: v.sku } });
          if (updated.count !== 1) throw new ConflictError('Stock changed. Reload the current quantity before saving.');
          variantId = existing.id;
        } else {
          if (v.expectedStock !== undefined) throw new ConflictError('Variant changed. Reload before saving.');
          const created = await tx.productVariant.create({ data: { productId, size: v.size, color: v.color, stock: v.stock, sku: v.sku ?? null } });
          variantId = created.id;
        }
        if (!existing || existing.stock !== v.stock) await tx.stockAdjustment.create({ data: {
          variantId, actorId, productName: product.name, size: v.size, color: v.color,
          before: existing?.stock ?? 0, after: v.stock, reason: existing ? 'editor' : 'initial',
        } });
      }
    });
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
