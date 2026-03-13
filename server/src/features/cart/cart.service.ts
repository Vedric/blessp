import { NotFoundError, ForbiddenError } from '../../core/errors/http.errors';
import { CartRepository } from './cart.repository';
import { CartResponse, CartItemResponse, AddToCartDto, UpdateCartItemDto } from './cart.types';
import { ProductsRepository } from '../products/products.repository';

export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productsRepository: ProductsRepository,
  ) {}

  async getCart(userId: string): Promise<CartResponse> {
    const items = await this.cartRepository.findByUserId(userId);
    return this.buildCartResponse(items);
  }

  async addToCart(userId: string, dto: AddToCartDto): Promise<CartResponse> {
    const product = await this.productsRepository.findById(dto.productId);

    if (!product) {
      throw new NotFoundError('Product', dto.productId);
    }

    if (!product.isActive) {
      throw new NotFoundError('Product', dto.productId);
    }

    await this.cartRepository.addItem(userId, dto);

    return this.getCart(userId);
  }

  async updateCartItem(userId: string, itemId: string, dto: UpdateCartItemDto): Promise<CartResponse> {
    const item = await this.cartRepository.findItemById(itemId);

    if (!item) {
      throw new NotFoundError('CartItem', itemId);
    }

    if (item.userId !== userId) {
      throw new ForbiddenError('You do not have access to this cart item.');
    }

    await this.cartRepository.updateQuantity(itemId, dto.quantity);

    return this.getCart(userId);
  }

  async removeFromCart(userId: string, itemId: string): Promise<void> {
    const item = await this.cartRepository.findItemById(itemId);

    if (!item) {
      throw new NotFoundError('CartItem', itemId);
    }

    if (item.userId !== userId) {
      throw new ForbiddenError('You do not have access to this cart item.');
    }

    await this.cartRepository.removeItem(itemId);
  }

  async clearCart(userId: string): Promise<void> {
    await this.cartRepository.clearCart(userId);
  }

  private buildCartResponse(
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      size: string | null;
      color: string | null;
      product: {
        id: string;
        name: string;
        price: number;
        picture: string | null;
        isActive: boolean;
      };
    }>,
  ): CartResponse {
    const cartItems: CartItemResponse[] = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      product: item.product,
    }));

    const totalCents = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return { items: cartItems, totalCents, itemCount };
  }
}
