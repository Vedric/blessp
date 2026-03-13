import { CartService } from '@features/cart/cart.service';
import { CartRepository } from '@features/cart/cart.repository';
import { ProductsRepository } from '@features/products/products.repository';
import { NotFoundError } from '@core/errors/http.errors';
import { makeProductFixture, makeInactiveProductFixture } from '../fixtures/product.fixture';

describe('CartService', () => {
  let service: CartService;
  let cartRepository: jest.Mocked<CartRepository>;
  let productsRepository: jest.Mocked<ProductsRepository>;

  const userId = 'usr_cart-owner';

  function makeCartItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ci_001',
      productId: 'prod_default-0001',
      userId,
      quantity: 2,
      size: 'M',
      color: 'black',
      createdAt: new Date('2025-06-01'),
      product: {
        id: 'prod_default-0001',
        name: 'Blessed Tee',
        price: 3500,
        picture: 'https://cdn.example.com/tee.jpg',
        isActive: true,
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    cartRepository = {
      findByUserId: jest.fn(),
      findItemById: jest.fn(),
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    } as unknown as jest.Mocked<CartRepository>;

    productsRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findFeatured: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<ProductsRepository>;

    service = new CartService(cartRepository, productsRepository);
  });

  describe('getCart', () => {
    it('returns cart with items, totalCents, and itemCount', async () => {
      const items = [
        makeCartItem({ id: 'ci_001', quantity: 2, product: { id: 'p1', name: 'Tee', price: 3500, picture: null, isActive: true } }),
        makeCartItem({ id: 'ci_002', quantity: 1, product: { id: 'p2', name: 'Cap', price: 2000, picture: null, isActive: true } }),
      ];

      cartRepository.findByUserId.mockResolvedValueOnce(items as any);

      const result = await service.getCart(userId);

      expect(result.items).toHaveLength(2);
      // totalCents: (3500 * 2) + (2000 * 1) = 9000
      expect(result.totalCents).toBe(9000);
      // itemCount: 2 + 1 = 3
      expect(result.itemCount).toBe(3);
    });

    it('returns an empty cart when user has no items', async () => {
      cartRepository.findByUserId.mockResolvedValueOnce([]);

      const result = await service.getCart(userId);

      expect(result.items).toHaveLength(0);
      expect(result.totalCents).toBe(0);
      expect(result.itemCount).toBe(0);
    });
  });

  describe('addToCart', () => {
    const addDto = { productId: 'prod_default-0001', quantity: 1, size: 'M', color: 'black' };

    it('adds an item to the cart and returns the updated cart', async () => {
      const product = makeProductFixture();
      productsRepository.findById.mockResolvedValueOnce(product);
      cartRepository.addItem.mockResolvedValueOnce(undefined as any);

      const cartItem = makeCartItem();
      cartRepository.findByUserId.mockResolvedValueOnce([cartItem] as any);

      const result = await service.addToCart(userId, addDto);

      expect(productsRepository.findById).toHaveBeenCalledWith(addDto.productId);
      expect(cartRepository.addItem).toHaveBeenCalledWith(userId, addDto);
      expect(result.items).toHaveLength(1);
    });

    it('throws NotFoundError when the product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.addToCart(userId, addDto)).rejects.toThrow(NotFoundError);
      expect(cartRepository.addItem).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the product is inactive', async () => {
      const inactiveProduct = makeInactiveProductFixture();
      productsRepository.findById.mockResolvedValueOnce(inactiveProduct);

      await expect(service.addToCart(userId, addDto)).rejects.toThrow(NotFoundError);
      expect(cartRepository.addItem).not.toHaveBeenCalled();
    });
  });

  describe('updateCartItem', () => {
    it('updates the quantity and returns the updated cart', async () => {
      const item = makeCartItem();
      cartRepository.findItemById.mockResolvedValueOnce(item as any);
      cartRepository.updateQuantity.mockResolvedValueOnce(undefined as any);
      cartRepository.findByUserId.mockResolvedValueOnce([{ ...item, quantity: 5 }] as any);

      const result = await service.updateCartItem(userId, item.id, { quantity: 5 });

      expect(cartRepository.updateQuantity).toHaveBeenCalledWith(item.id, 5);
      expect(result.items).toHaveLength(1);
    });

    it('throws NotFoundError when the cart item does not exist', async () => {
      cartRepository.findItemById.mockResolvedValueOnce(null);

      await expect(
        service.updateCartItem(userId, 'ci_nonexistent', { quantity: 3 }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the cart item belongs to another user', async () => {
      const item = makeCartItem({ userId: 'usr_other-user' });
      cartRepository.findItemById.mockResolvedValueOnce(item as any);

      await expect(
        service.updateCartItem(userId, item.id, { quantity: 3 }),
      ).rejects.toThrow();
      expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
    });
  });

  describe('removeFromCart', () => {
    it('removes the item from the cart', async () => {
      const item = makeCartItem();
      cartRepository.findItemById.mockResolvedValueOnce(item as any);
      cartRepository.removeItem.mockResolvedValueOnce(undefined as any);

      await service.removeFromCart(userId, item.id);

      expect(cartRepository.removeItem).toHaveBeenCalledWith(item.id);
    });

    it('throws NotFoundError when the item does not exist', async () => {
      cartRepository.findItemById.mockResolvedValueOnce(null);

      await expect(service.removeFromCart(userId, 'ci_nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('clearCart', () => {
    it('clears all items for the user', async () => {
      cartRepository.clearCart.mockResolvedValueOnce(undefined as any);

      await service.clearCart(userId);

      expect(cartRepository.clearCart).toHaveBeenCalledWith(userId);
    });
  });
});
