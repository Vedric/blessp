import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../core/database/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/http.errors';
import type { InventoryAdjustment, InventoryQuery } from './inventory.schema';

const productSelect = { id: true, name: true, picture: true, isActive: true, sizes: true, colors: true } as const;
export class InventoryService {
  async list(query: InventoryQuery) {
    const where: Prisma.ProductVariantWhereInput = {
      product: { deletedAt: null },
      ...(query.status === 'low' ? { stock: { gt: 0, lte: 5 } } : query.status === 'out' ? { stock: 0 } : query.status === 'available' ? { stock: { gt: 0 } } : {}),
      ...(query.search ? { OR: [{ product: { name: { contains: query.search, mode: 'insensitive' } } }, { sku: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [items, summary, unconfiguredProducts] = await prisma.$transaction([
      prisma.productVariant.findMany({ where, include: { product: { select: productSelect } }, orderBy: [{ stock: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.perPage, take: query.perPage }),
      prisma.productVariant.aggregate({ where, _count: true, _sum: { stock: true } }),
      prisma.product.count({ where: { deletedAt: null, variants: { none: {} } } }),
    ]);
    return { items, available: summary._sum.stock ?? 0, unconfiguredProducts, pagination: { page: query.page, perPage: query.perPage, totalItems: summary._count, totalPages: Math.ceil(summary._count / query.perPage) } };
  }

  async history(variantId: string, page: number, perPage: number) {
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, product: { deletedAt: null } } });
    if (!variant) throw new NotFoundError('Variant', variantId);
    const where = { variantId };
    const [items, totalItems] = await prisma.$transaction([
      prisma.stockAdjustment.findMany({ where, select: { id: true, before: true, after: true, reason: true, note: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * perPage, take: perPage }),
      prisma.stockAdjustment.count({ where }),
    ]);
    return { items, pagination: { page, perPage, totalItems, totalPages: Math.ceil(totalItems / perPage) } };
  }

  async adjust(variantId: string, actorId: string, input: InventoryAdjustment) {
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ variantId, actorId, ...input })).digest('hex');
    return transaction(async tx => {
      await lockResource(tx, `inventory-request:${input.requestId}`);
      const prior = await tx.stockAdjustment.findUnique({ where: { requestId: input.requestId } });
      if (prior) {
        if (prior.requestHash !== requestHash) throw new ConflictError('Adjustment key already used for different details.');
        return { id: prior.id, stock: prior.after };
      }
      const variant = await tx.productVariant.findFirst({ where: { id: variantId, product: { deletedAt: null } }, include: { product: { select: { name: true } } } });
      if (!variant) throw new NotFoundError('Variant', variantId);
      if (input.stock === input.expectedStock) throw new ValidationError('The stock adjustment must change the quantity.');
      const updated = await tx.productVariant.updateMany({ where: { id: variantId, stock: input.expectedStock }, data: { stock: input.stock } });
      if (updated.count !== 1) throw new ConflictError('Stock changed. Reload the current quantity before adjusting it.');
      const adjustment = await tx.stockAdjustment.create({ data: {
        variantId, actorId, productName: variant.product.name, size: variant.size, color: variant.color,
        before: input.expectedStock, after: input.stock, reason: input.reason, note: input.note || null,
        requestId: input.requestId, requestHash,
      } });
      return { id: adjustment.id, stock: input.stock };
    });
  }
}
