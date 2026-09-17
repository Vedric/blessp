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
    // Aggregate in PostgreSQL: only the distinct facets cross the DB boundary.
    // Separate unnests avoid multiplying colors by sizes for each product.
    const [row] = await prisma.$queryRaw<Array<{
      categories: string[]; colors: string[]; sizes: string[]; min: number; max: number;
    }>>`
      WITH live AS MATERIALIZED (
        SELECT category, colors, sizes, price FROM products
        WHERE deleted_at IS NULL AND is_active = true
      )
      SELECT
        ARRAY(SELECT DISTINCT category FROM live WHERE category IS NOT NULL AND category <> '' ORDER BY category) AS categories,
        ARRAY(SELECT DISTINCT unnest(colors) AS color FROM live ORDER BY color) AS colors,
        ARRAY(SELECT DISTINCT unnest(sizes) AS size FROM live ORDER BY size) AS sizes,
        COALESCE(MIN(price), 0)::integer AS min,
        COALESCE(MAX(price), 0)::integer AS max
      FROM live
    `;
    return { categories: row.categories, colors: row.colors, sizes: row.sizes, priceRange: { min: row.min, max: row.max } };
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
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    }

    const allowedFields = new Set(['name', 'price', 'createdAt', 'updatedAt', 'category']);

    const fields = sort.split(',').reduce<Prisma.ProductOrderByWithRelationInput[]>((acc, part) => {
      const [field, direction] = part.split(':');
      const trimmedField = field?.trim();
      const trimmedDirection = direction?.trim()?.toLowerCase();

      if (trimmedField && allowedFields.has(trimmedField)) {
        const dir = trimmedDirection === 'asc' ? 'asc' : 'desc';
        acc.push({ [trimmedField]: dir });
      }

      return acc;
    }, []);
    // Stable page boundaries when prices or timestamps tie.
    return [...(fields.length ? fields : [{ createdAt: 'desc' as const }]), { id: 'asc' }];
  }
}
