import { prisma } from '../../core/database/client';
import type { CreateReviewDto, UpdateReviewDto, ReviewSummary } from './reviews.types';

const userSelect = {
  firstName: true,
  lastName: true,
};

export class ReviewsRepository {
  async findByProductId(productId: string, page: number, perPage: number) {
    const skip = (page - 1) * perPage;

    const [items, totalItems] = await Promise.all([
      prisma.review.findMany({
        where: { productId },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.review.count({ where: { productId } }),
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
    return prisma.review.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
  }

  async findByUserAndProduct(userId: string, productId: string) {
    return prisma.review.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
      include: { user: { select: userSelect } },
    });
  }

  async create(userId: string, dto: CreateReviewDto) {
    return prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
      },
      include: { user: { select: userSelect } },
    });
  }

  async update(id: string, dto: UpdateReviewDto) {
    return prisma.review.update({
      where: { id },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
      },
      include: { user: { select: userSelect } },
    });
  }

  async delete(id: string) {
    return prisma.review.delete({
      where: { id },
    });
  }

  async findAll(page: number, perPage: number) {
    const skip = (page - 1) * perPage;

    const [items, totalItems] = await Promise.all([
      prisma.review.findMany({
        include: {
          user: { select: userSelect },
          product: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      prisma.review.count(),
    ]);

    return {
      items,
      totalItems,
      page,
      perPage,
      totalPages: Math.ceil(totalItems / perPage),
    };
  }

  async getProductSummary(productId: string): Promise<ReviewSummary> {
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: { rating: true },
    });

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const review of reviews) {
      sum += review.rating;
      distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    }

    const averageRating = Math.round((sum / totalReviews) * 10) / 10;

    return { averageRating, totalReviews, distribution };
  }
}
