import { NotFoundError } from '../../core/errors/http.errors';
import { WishlistRepository } from './wishlist.repository';
import { ProductsRepository } from '../products/products.repository';
import type { WishlistItemResponse, ToggleWishlistResult } from './wishlist.types';

export class WishlistService {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async getWishlist(userId: string): Promise<WishlistItemResponse[]> {
    const items = await this.wishlistRepository.findByUserId(userId);

    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt.toISOString(),
      product: item.product,
    }));
  }

  async toggleWishlistItem(userId: string, productId: string): Promise<ToggleWishlistResult> {
    const product = await this.productsRepository.findById(productId);

    if (!product || !product.isActive) {
      throw new NotFoundError('Product', productId);
    }

    const existing = await this.wishlistRepository.findByUserAndProduct(userId, productId);

    if (existing) {
      await this.wishlistRepository.removeByUserAndProduct(userId, productId);
      return { added: false, item: null };
    }

    const created = await this.wishlistRepository.addItem(userId, productId);

    return {
      added: true,
      item: {
        id: created.id,
        productId: created.productId,
        createdAt: created.createdAt.toISOString(),
        product: created.product,
      },
    };
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const existing = await this.wishlistRepository.findByUserAndProduct(userId, productId);

    if (!existing) {
      throw new NotFoundError('WishlistItem', productId);
    }

    await this.wishlistRepository.removeByUserAndProduct(userId, productId);
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.wishlistRepository.findByUserAndProduct(userId, productId);
    return item !== null;
  }
}
