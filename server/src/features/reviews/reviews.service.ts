import { NotFoundError, ConflictError, ForbiddenError } from '../../core/errors/http.errors';
import { ReviewsRepository } from './reviews.repository';
import { ProductsRepository } from '../products/products.repository';
import type { ReviewResponse, CreateReviewDto, UpdateReviewDto, ReviewSummary } from './reviews.types';

function toReviewResponse(review: {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  user: { firstName: string; lastName: string };
  createdAt: Date;
  updatedAt: Date;
}): ReviewResponse {
  return {
    id: review.id,
    userId: review.userId,
    productId: review.productId,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    user: review.user,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async getProductReviews(productId: string, page: number, perPage: number) {
    const result = await this.reviewsRepository.findByProductId(productId, page, perPage);

    return {
      items: result.items.map(toReviewResponse),
      totalItems: result.totalItems,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }

  async getReviewSummary(productId: string): Promise<ReviewSummary> {
    return this.reviewsRepository.getProductSummary(productId);
  }

  async createReview(userId: string, dto: CreateReviewDto): Promise<ReviewResponse> {
    const product = await this.productsRepository.findById(dto.productId);
    if (!product || !product.isActive) {
      throw new NotFoundError('Product', dto.productId);
    }

    const existing = await this.reviewsRepository.findByUserAndProduct(userId, dto.productId);
    if (existing) {
      throw new ConflictError('You have already reviewed this product.');
    }

    const review = await this.reviewsRepository.create(userId, dto);
    return toReviewResponse(review);
  }

  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto): Promise<ReviewResponse> {
    const review = await this.reviewsRepository.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    if (review.userId !== userId) {
      throw new ForbiddenError('You can only edit your own reviews.');
    }

    const updated = await this.reviewsRepository.update(reviewId, dto);
    return toReviewResponse(updated);
  }

  async getAllReviews(page: number, perPage: number) {
    const result = await this.reviewsRepository.findAll(page, perPage);

    return {
      items: result.items.map((review) => ({
        id: review.id,
        userId: review.userId,
        productId: review.productId,
        productName: (review as { product?: { name: string } }).product?.name ?? 'Unknown',
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        user: review.user,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      })),
      totalItems: result.totalItems,
      page: result.page,
      perPage: result.perPage,
      totalPages: result.totalPages,
    };
  }

  async adminDeleteReview(reviewId: string): Promise<void> {
    const review = await this.reviewsRepository.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    await this.reviewsRepository.delete(reviewId);
  }

  async deleteReview(userId: string, reviewId: string): Promise<void> {
    const review = await this.reviewsRepository.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review', reviewId);
    }

    if (review.userId !== userId) {
      throw new ForbiddenError('You can only delete your own reviews.');
    }

    await this.reviewsRepository.delete(reviewId);
  }
}
