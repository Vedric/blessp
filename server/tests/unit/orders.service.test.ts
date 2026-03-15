import { OrdersService } from '@features/orders/orders.service';
import { OrdersRepository } from '@features/orders/orders.repository';
import { CartRepository } from '@features/cart/cart.repository';
import { CouponsService } from '@features/coupons/coupons.service';
import { VariantsRepository } from '@features/products/variants.repository';
import { NotFoundError, ForbiddenError, ValidationError } from '@core/errors/http.errors';

jest.mock('@features/products/variants.repository');
jest.mock('@core/queue/email.producer', () => ({
  enqueueOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepository: jest.Mocked<OrdersRepository>;
  let cartRepository: jest.Mocked<CartRepository>;
  let couponsService: jest.Mocked<CouponsService>;
  let variantsRepository: jest.Mocked<VariantsRepository>;

  const userId = 'usr_order-owner';

  const shippingDto = {
    firstName: 'Alice',
    lastName: 'Dupont',
    phone: '+33612345678',
    addressLine1: '12 Rue de Paris',
    city: 'Paris',
    postalCode: '75001',
    country: 'FR',
  };

  function makeCartItem(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ci_001',
      productId: 'prod_001',
      userId,
      quantity: 2,
      size: 'M',
      color: 'black',
      createdAt: new Date(),
      product: {
        id: 'prod_001',
        name: 'Blessed Tee',
        price: 3500,
        picture: null,
        isActive: true,
      },
      ...overrides,
    };
  }

  function makeOrderFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ord_001',
      userId,
      totalCents: 7000,
      discountCents: 0,
      couponCode: null,
      status: 'pending',
      transactionKey: null,
      shippingAddress: { firstName: 'Alice', lastName: 'Dupont', city: 'Paris' },
      items: [
        {
          id: 'oi_001',
          productId: 'prod_001',
          productKey: 'prod_001',
          productName: 'Blessed Tee',
          quantity: 2,
          unitPriceCents: 3500,
          size: 'M',
          color: 'black',
        },
      ],
      createdAt: new Date('2025-06-15T10:00:00Z'),
      updatedAt: new Date('2025-06-15T10:00:00Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    ordersRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findAll: jest.fn(),
      updateStatus: jest.fn(),
      updateTransactionKey: jest.fn(),
      createStatusHistoryEntry: jest.fn(),
      findStatusHistory: jest.fn(),
    } as unknown as jest.Mocked<OrdersRepository>;

    cartRepository = {
      findByUserId: jest.fn(),
      findItemById: jest.fn(),
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    } as unknown as jest.Mocked<CartRepository>;

    couponsService = {
      applyCoupon: jest.fn(),
      validateCoupon: jest.fn(),
    } as unknown as jest.Mocked<CouponsService>;

    variantsRepository = {
      findByProductId: jest.fn(),
      findByProductAndVariant: jest.fn(),
      upsertMany: jest.fn(),
      decrementStock: jest.fn(),
    } as unknown as jest.Mocked<VariantsRepository>;

    service = new OrdersService(ordersRepository, cartRepository, couponsService, variantsRepository);
  });

  describe('createOrder', () => {
    it('creates an order from the cart and clears the cart afterwards', async () => {
      const cartItems = [
        makeCartItem({ id: 'ci_001', quantity: 2, product: { id: 'prod_001', name: 'Blessed Tee', price: 3500, picture: null, isActive: true } }),
      ];

      const order = makeOrderFixture();

      cartRepository.findByUserId.mockResolvedValueOnce(cartItems as any);
      variantsRepository.findByProductAndVariant.mockResolvedValueOnce({ stock: 10 } as any);
      ordersRepository.create.mockResolvedValueOnce(order as any);
      variantsRepository.decrementStock.mockResolvedValueOnce(undefined as any);
      cartRepository.clearCart.mockResolvedValueOnce(undefined as any);
      ordersRepository.createStatusHistoryEntry.mockResolvedValueOnce(undefined as any);

      const result = await service.createOrder(userId, shippingDto);

      expect(result.id).toBe(order.id);
      expect(result.totalCents).toBe(order.totalCents);
      expect(result.status).toBe('pending');
      expect(result.items).toHaveLength(1);

      // Verify cart was cleared after order creation
      expect(cartRepository.clearCart).toHaveBeenCalledWith(userId);

      // Verify order was created with correct total
      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          totalCents: 7000, // 3500 * 2
          shippingAddress: expect.objectContaining({
            firstName: shippingDto.firstName,
            city: shippingDto.city,
          }),
        }),
      );
    });

    it('throws ValidationError when the cart is empty', async () => {
      cartRepository.findByUserId.mockResolvedValueOnce([]);

      await expect(service.createOrder(userId, shippingDto)).rejects.toThrow(ValidationError);
      expect(ordersRepository.create).not.toHaveBeenCalled();
      expect(cartRepository.clearCart).not.toHaveBeenCalled();
    });

    it('throws ValidationError when the cart contains inactive products', async () => {
      const cartItems = [
        makeCartItem({
          product: { id: 'prod_001', name: 'Discontinued Item', price: 5000, picture: null, isActive: false },
        }),
      ];

      cartRepository.findByUserId.mockResolvedValueOnce(cartItems as any);

      await expect(service.createOrder(userId, shippingDto)).rejects.toThrow(ValidationError);
      expect(ordersRepository.create).not.toHaveBeenCalled();
    });

    it('calculates the correct total from multiple cart items', async () => {
      const cartItems = [
        makeCartItem({ id: 'ci_001', quantity: 2, product: { id: 'p1', name: 'Tee', price: 3500, picture: null, isActive: true } }),
        makeCartItem({ id: 'ci_002', quantity: 1, product: { id: 'p2', name: 'Cap', price: 2000, picture: null, isActive: true } }),
      ];

      const order = makeOrderFixture({ totalCents: 9000 });

      cartRepository.findByUserId.mockResolvedValueOnce(cartItems as any);
      variantsRepository.findByProductAndVariant.mockResolvedValue({ stock: 50 } as any);
      ordersRepository.create.mockResolvedValueOnce(order as any);
      variantsRepository.decrementStock.mockResolvedValue(undefined as any);
      cartRepository.clearCart.mockResolvedValueOnce(undefined as any);
      ordersRepository.createStatusHistoryEntry.mockResolvedValueOnce(undefined as any);

      await service.createOrder(userId, shippingDto);

      // totalCents should be (3500 * 2) + (2000 * 1) = 9000
      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalCents: 9000 }),
      );
    });
  });

  describe('getOrder', () => {
    it('returns the order when the requesting user is the owner', async () => {
      const order = makeOrderFixture();
      ordersRepository.findById.mockResolvedValueOnce(order as any);

      const result = await service.getOrder(userId, order.id, false);

      expect(result.id).toBe(order.id);
      expect(result.userId).toBe(userId);
    });

    it('returns the order when the requesting user is an admin', async () => {
      const order = makeOrderFixture({ userId: 'usr_someone-else' });
      ordersRepository.findById.mockResolvedValueOnce(order as any);

      const result = await service.getOrder('usr_admin', order.id, true);

      expect(result.id).toBe(order.id);
    });

    it('throws NotFoundError when the order does not exist', async () => {
      ordersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getOrder(userId, 'ord_nonexistent', false),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when a non-owner, non-admin user requests the order', async () => {
      const order = makeOrderFixture({ userId: 'usr_someone-else' });
      ordersRepository.findById.mockResolvedValueOnce(order as any);

      await expect(
        service.getOrder(userId, order.id, false),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getUserOrders', () => {
    it('returns paginated orders for the user', async () => {
      const orders = [
        makeOrderFixture({ id: 'ord_001' }),
        makeOrderFixture({ id: 'ord_002' }),
      ];

      ordersRepository.findByUserId.mockResolvedValueOnce({
        items: orders,
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1,
      } as any);

      const result = await service.getUserOrders(userId, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalItems).toBe(2);
      expect(ordersRepository.findByUserId).toHaveBeenCalledWith(userId, { page: 1, perPage: 20 });
    });

    it('returns an empty list when the user has no orders', async () => {
      ordersRepository.findByUserId.mockResolvedValueOnce({
        items: [],
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
      } as any);

      const result = await service.getUserOrders(userId, {});

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });

    it('filters orders by status', async () => {
      ordersRepository.findByUserId.mockResolvedValueOnce({
        items: [],
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
      } as any);

      await service.getUserOrders(userId, { status: 'completed' });

      expect(ordersRepository.findByUserId).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('updates the order status for a valid transition', async () => {
      const order = makeOrderFixture({ status: 'pending' });
      const updatedOrder = makeOrderFixture({ status: 'confirmed' });

      ordersRepository.findById.mockResolvedValueOnce(order as any);
      ordersRepository.updateStatus.mockResolvedValueOnce(updatedOrder as any);
      ordersRepository.createStatusHistoryEntry.mockResolvedValueOnce(undefined as any);

      const result = await service.updateOrderStatus(order.id, 'confirmed');

      expect(result.status).toBe('confirmed');
      expect(ordersRepository.updateStatus).toHaveBeenCalledWith(order.id, 'confirmed');
    });

    it('records a note in the status history when provided', async () => {
      const order = makeOrderFixture({ status: 'pending' });
      const updatedOrder = makeOrderFixture({ status: 'cancelled' });

      ordersRepository.findById.mockResolvedValueOnce(order as any);
      ordersRepository.updateStatus.mockResolvedValueOnce(updatedOrder as any);
      ordersRepository.createStatusHistoryEntry.mockResolvedValueOnce(undefined as any);

      await service.updateOrderStatus(order.id, 'cancelled', 'Customer requested cancellation');

      expect(ordersRepository.createStatusHistoryEntry).toHaveBeenCalledWith(
        order.id,
        'cancelled',
        'Customer requested cancellation',
      );
    });

    it('rejects invalid status transitions', async () => {
      const order = makeOrderFixture({ status: 'pending' });
      ordersRepository.findById.mockResolvedValueOnce(order as any);

      await expect(
        service.updateOrderStatus(order.id, 'shipped'),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects transitions from terminal states', async () => {
      const order = makeOrderFixture({ status: 'cancelled' });
      ordersRepository.findById.mockResolvedValueOnce(order as any);

      await expect(
        service.updateOrderStatus(order.id, 'confirmed'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when the order does not exist', async () => {
      ordersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateOrderStatus('ord_nonexistent', 'shipped'),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
