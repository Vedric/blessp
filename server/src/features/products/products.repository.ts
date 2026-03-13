import { Prisma } from '@prisma/client';
import { prisma } from '../../core/database/client';
import { CreateProductDto, UpdateProductDto, ProductQueryParams } from './products.types';

export class ProductsRepository {
  async findAll(params: ProductQueryParams) {
    const { page = 1, perPage = 20, category, search, sort, isActive, minPrice, maxPrice, colors, sizes } = params;
    const skip = (page - 1) * perPage;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(category && { category }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(minPrice !== undefined && { price: { gte: minPrice } }),
      ...(maxPrice !== undefined && { price: { ...(minPrice !== undefined ? { gte: minPrice } : {}), lte: maxPrice } }),
      ...(colors && colors.length > 0 && { colors: { hasSome: colors } }),
      ...(sizes && sizes.length > 0 && { sizes: { hasSome: sizes } }),
    };

    const orderBy = this.parseSortParam(sort);

    const [items, totalItems] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: perPage,
        include: { variants: { select: { stock: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      totalItems,
      page,
      perPage,
      totalPages: Math.ceil(totalItems / perPage),
    };
  }

  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id, deletedAt: null },
      include: { variants: { select: { stock: true } } },
    });
  }

  async findFeatured() {
    return prisma.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        onfrontOrder: { not: null },
      },
      orderBy: { onfrontOrder: 'asc' },
      include: { variants: { select: { stock: true } } },
    });
  }

  async create(data: CreateProductDto) {
    return prisma.product.create({
      data: {
        name: data.name,
        price: data.price,
        description: data.description,
        details: data.details,
        picture: data.picture,
        images: data.images ?? [],
        category: data.category,
        colors: data.colors ?? [],
        sizes: data.sizes ?? [],
        isActive: data.isActive ?? true,
        onfrontOrder: data.onfrontOrder,
      },
    });
  }

  async update(id: string, data: UpdateProductDto) {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  async findFilters() {
    const products = await prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: { category: true, colors: true, sizes: true, price: true },
    });

    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
    const colors = [...new Set(products.flatMap((p) => p.colors))];
    const sizes = [...new Set(products.flatMap((p) => p.sizes))];
    const prices = products.map((p) => p.price);
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
    };

    return { categories, colors, sizes, priceRange };
  }

  async findCompleteLookCandidates(excludeId: string, categories: string[], colors: string[]) {
    return prisma.product.findMany({
      where: {
        id: { not: excludeId },
        deletedAt: null,
        isActive: true,
        category: { in: categories },
        ...(colors.length > 0 && { colors: { hasSome: colors } }),
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  }

  async softDelete(id: string) {
    return prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private parseSortParam(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
    if (!sort) {
      return [{ createdAt: 'desc' }];
    }

    const allowedFields = new Set(['name', 'price', 'createdAt', 'updatedAt', 'category']);

    return sort.split(',').reduce<Prisma.ProductOrderByWithRelationInput[]>((acc, part) => {
      const [field, direction] = part.split(':');
      const trimmedField = field?.trim();
      const trimmedDirection = direction?.trim()?.toLowerCase();

      if (trimmedField && allowedFields.has(trimmedField)) {
        const dir = trimmedDirection === 'asc' ? 'asc' : 'desc';
        acc.push({ [trimmedField]: dir });
      }

      return acc;
    }, []);
  }
}
