import { ReviewsService } from '@features/reviews/reviews.service';
import { ReviewsRepository } from '@features/reviews/reviews.repository';
import { ProductsRepository } from '@features/products/products.repository';
import { NotFoundError, ConflictError, ForbiddenError } from '@core/errors/http.errors';
import { makeReviewFixture, makeReviewWithProductFixture } from '../fixtures/review.fixture';

jest.mock('@features/reviews/reviews.repository');
jest.mock('@features/products/products.repository');

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewsRepository: jest.Mocked<ReviewsRepository>;
  let productsRepository: jest.Mocked<ProductsRepository>;

  const userId = 'usr_reviewer';

  beforeEach(() => {
    jest.clearAllMocks();

    reviewsRepository = {
      findByProductId: jest.fn(),
      findById: jest.fn(),
      findByUserAndProduct: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      getProductSummary: jest.fn(),
    } as unknown as jest.Mocked<ReviewsRepository>;

    productsRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ProductsRepository>;

    service = new ReviewsService(reviewsRepository, productsRepository);
  });

  describe('getProductReviews', () => {
    it('returns paginated reviews for a product', async () => {
      const reviews = [makeReviewFixture(), makeReviewFixture({ id: 'rev_002' })];
      reviewsRepository.findByProductId.mockResolvedValueOnce({
        items: reviews,
        totalItems: 2,
        page: 1,
        perPage: 20,
        totalPages: 1,
      } as any);

      const result = await service.getProductReviews('prod_001', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
      expect(result.page).toBe(1);
      expect(reviewsRepository.findByProductId).toHaveBeenCalledWith('prod_001', 1, 20);
    });

    it('returns an empty list when no reviews exist', async () => {
      reviewsRepository.findByProductId.mockResolvedValueOnce({
        items: [],
        totalItems: 0,
        page: 1,
        perPage: 20,
        totalPages: 0,
      } as any);

      const result = await service.getProductReviews('prod_001', 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });
  });

  describe('getReviewSummary', () => {
    it('returns the review summary for a product', async () => {
      const summary = { averageRating: 4.2, totalReviews: 10, distribution: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 } };
      reviewsRepository.getProductSummary.mockResolvedValueOnce(summary);

      const result = await service.getReviewSummary('prod_001');

      expect(result).toEqual(summary);
      expect(reviewsRepository.getProductSummary).toHaveBeenCalledWith('prod_001');
    });
  });

  describe('createReview', () => {
    const createDto = { productId: 'prod_001', rating: 5, title: 'Amazing', comment: 'Love it' };

    it('creates a review when the product exists and user has not reviewed it', async () => {
      productsRepository.findById.mockResolvedValueOnce({ id: 'prod_001', isActive: true } as any);
      reviewsRepository.findByUserAndProduct.mockResolvedValueOnce(null);
      reviewsRepository.create.mockResolvedValueOnce(makeReviewFixture({ rating: 5 }) as any);

      const result = await service.createReview(userId, createDto);

      expect(result.rating).toBe(5);
      expect(reviewsRepository.create).toHaveBeenCalledWith(userId, createDto);
    });

    it('throws NotFoundError when the product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.createReview(userId, createDto)).rejects.toThrow(NotFoundError);
      expect(reviewsRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the product is inactive', async () => {
      productsRepository.findById.mockResolvedValueOnce({ id: 'prod_001', isActive: false } as any);

      await expect(service.createReview(userId, createDto)).rejects.toThrow(NotFoundError);
      expect(reviewsRepository.create).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the user has already reviewed the product', async () => {
      productsRepository.findById.mockResolvedValueOnce({ id: 'prod_001', isActive: true } as any);
      reviewsRepository.findByUserAndProduct.mockResolvedValueOnce(makeReviewFixture() as any);

      await expect(service.createReview(userId, createDto)).rejects.toThrow(ConflictError);
      expect(reviewsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateReview', () => {
    const updateDto = { rating: 3, comment: 'Changed my mind' };

    it('updates a review when the user is the owner', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(makeReviewFixture() as any);
      reviewsRepository.update.mockResolvedValueOnce(
        makeReviewFixture({ rating: 3, comment: 'Changed my mind' }) as any,
      );

      const result = await service.updateReview(userId, 'rev_001', updateDto);

      expect(result.rating).toBe(3);
      expect(reviewsRepository.update).toHaveBeenCalledWith('rev_001', updateDto);
    });

    it('throws NotFoundError when the review does not exist', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.updateReview(userId, 'rev_nonexistent', updateDto)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user is not the review owner', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(
        makeReviewFixture({ userId: 'usr_someone-else' }) as any,
      );

      await expect(service.updateReview(userId, 'rev_001', updateDto)).rejects.toThrow(ForbiddenError);
      expect(reviewsRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteReview', () => {
    it('deletes a review when the user is the owner', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(makeReviewFixture() as any);
      reviewsRepository.delete.mockResolvedValueOnce(undefined as any);

      await service.deleteReview(userId, 'rev_001');

      expect(reviewsRepository.delete).toHaveBeenCalledWith('rev_001');
    });

    it('throws NotFoundError when the review does not exist', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deleteReview(userId, 'rev_nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the user is not the review owner', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(
        makeReviewFixture({ userId: 'usr_someone-else' }) as any,
      );

      await expect(service.deleteReview(userId, 'rev_001')).rejects.toThrow(ForbiddenError);
      expect(reviewsRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('adminDeleteReview', () => {
    it('deletes any review regardless of ownership', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(makeReviewFixture() as any);
      reviewsRepository.delete.mockResolvedValueOnce(undefined as any);

      await service.adminDeleteReview('rev_001');

      expect(reviewsRepository.delete).toHaveBeenCalledWith('rev_001');
    });

    it('throws NotFoundError when the review does not exist', async () => {
      reviewsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.adminDeleteReview('rev_nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllReviews', () => {
    it('returns paginated reviews with product names', async () => {
      const reviews = [
        makeReviewWithProductFixture({ id: 'rev_001' }),
        makeReviewWithProductFixture({ id: 'rev_002', product: { name: 'Cap' } }),
      ];

      reviewsRepository.findAll.mockResolvedValueOnce({
        items: reviews,
        totalItems: 2,
        page: 1,
        perPage: 20,
        totalPages: 1,
      } as any);

      const result = await service.getAllReviews(1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].productName).toBe('Blessed Tee');
      expect(result.items[1].productName).toBe('Cap');
    });

    it('uses "Unknown" when the product name is missing', async () => {
      const reviewWithoutProduct = makeReviewFixture();

      reviewsRepository.findAll.mockResolvedValueOnce({
        items: [reviewWithoutProduct],
        totalItems: 1,
        page: 1,
        perPage: 10,
        totalPages: 1,
      } as any);

      const result = await service.getAllReviews(1, 10);

      expect(result.items[0].productName).toBe('Unknown');
    });
  });
});
