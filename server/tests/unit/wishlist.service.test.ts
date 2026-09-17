jest.mock('@core/database/client', () => ({ prisma: {} }));
jest.mock('@core/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { WishlistService } from '@features/wishlist/wishlist.service';
import { WishlistRepository } from '@features/wishlist/wishlist.repository';
import { ProductsRepository } from '@features/products/products.repository';
import { NotFoundError } from '@core/errors/http.errors';

jest.mock('@features/wishlist/wishlist.repository');
jest.mock('@features/products/products.repository');

describe('WishlistService', () => {
  let service: WishlistService;
  let wishlistRepository: jest.Mocked<WishlistRepository>;
  let productsRepository: jest.Mocked<ProductsRepository>;

  const userId = 'usr_shopper';
  const productId = 'prod_001';

  function makeProductFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: productId,
      name: 'Blessed Hoodie',
      price: 12900,
      picture: 'hoodie.jpg',
      images: ['hoodie.jpg'],
      category: 'hoodies',
      isActive: true,
      ...overrides,
    };
  }

  function makeWishlistItemFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'wl_001',
      userId,
      productId,
      createdAt: new Date('2026-02-01T12:00:00Z'),
      product: makeProductFixture(),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    wishlistRepository = {
      findByUserId: jest.fn(),
      findByUserAndProduct: jest.fn(),
      addItem: jest.fn(),
      removeByUserAndProduct: jest.fn(),
    } as unknown as jest.Mocked<WishlistRepository>;

    productsRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ProductsRepository>;

    service = new WishlistService(wishlistRepository, productsRepository);
  });

  describe('getWishlist', () => {
    it('returns mapped items with ISO date strings', async () => {
      const items = [makeWishlistItemFixture()];
      wishlistRepository.findByUserId.mockResolvedValueOnce(items as any);

      const result = await service.getWishlist(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('wl_001');
      expect(result[0].productId).toBe(productId);
      expect(result[0].createdAt).toBe('2026-02-01T12:00:00.000Z');
      expect(result[0].product).toEqual(makeProductFixture());
    });

    it('returns empty array when no items', async () => {
      wishlistRepository.findByUserId.mockResolvedValueOnce([]);

      const result = await service.getWishlist(userId);

      expect(result).toEqual([]);
    });
  });

  describe('toggleWishlistItem', () => {
    it('adds item when not in wishlist (returns added: true)', async () => {
      productsRepository.findById.mockResolvedValueOnce(makeProductFixture() as any);
      wishlistRepository.findByUserAndProduct.mockResolvedValueOnce(null);
      wishlistRepository.addItem.mockResolvedValueOnce(makeWishlistItemFixture() as any);

      const result = await service.toggleWishlistItem(userId, productId);

      expect(result.added).toBe(true);
      expect(result.item).not.toBeNull();
      expect(result.item!.productId).toBe(productId);
      expect(wishlistRepository.addItem).toHaveBeenCalledWith(userId, productId);
    });

    it('removes item when already in wishlist (returns added: false)', async () => {
      productsRepository.findById.mockResolvedValueOnce(makeProductFixture() as any);
      wishlistRepository.findByUserAndProduct.mockResolvedValueOnce(makeWishlistItemFixture() as any);
      wishlistRepository.removeByUserAndProduct.mockResolvedValueOnce(undefined as any);

      const result = await service.toggleWishlistItem(userId, productId);

      expect(result.added).toBe(false);
      expect(result.item).toBeNull();
      expect(wishlistRepository.removeByUserAndProduct).toHaveBeenCalledWith(userId, productId);
    });

    it('throws NotFoundError for nonexistent product', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.toggleWishlistItem(userId, productId)).rejects.toThrow(NotFoundError);
      expect(wishlistRepository.addItem).not.toHaveBeenCalled();
    });

    it('throws NotFoundError for inactive product', async () => {
      productsRepository.findById.mockResolvedValueOnce(
        makeProductFixture({ isActive: false }) as any,
      );

      await expect(service.toggleWishlistItem(userId, productId)).rejects.toThrow(NotFoundError);
      expect(wishlistRepository.addItem).not.toHaveBeenCalled();
    });
  });

  describe('removeFromWishlist', () => {
    it('removes existing item', async () => {
      wishlistRepository.findByUserAndProduct.mockResolvedValueOnce(makeWishlistItemFixture() as any);
      wishlistRepository.removeByUserAndProduct.mockResolvedValueOnce(undefined as any);

      await service.removeFromWishlist(userId, productId);

      expect(wishlistRepository.removeByUserAndProduct).toHaveBeenCalledWith(userId, productId);
    });

    it('throws NotFoundError when item not in wishlist', async () => {
      wishlistRepository.findByUserAndProduct.mockResolvedValueOnce(null);

      await expect(service.removeFromWishlist(userId, productId)).rejects.toThrow(NotFoundError);
      expect(wishlistRepository.removeByUserAndProduct).not.toHaveBeenCalled();
    });
  });

  describe('isInWishlist', () => {
    it('returns true when item exists', async () => {
      wishlistRepository.findByUserAndProduct.mockResolvedValueOnce(makeWishlistItemFixture() as any);

      const result = await service.isInWishlist(userId, productId);

      expect(result).toBe(true);
    });

    it('returns false when item does not exist', async () => {
      wishlistRepository.findByUserAndProduct.mockResolvedValueOnce(null);

      const result = await service.isInWishlist(userId, productId);

      expect(result).toBe(false);
    });
  });
});
