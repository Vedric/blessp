jest.mock('@core/database/client', () => ({
  prisma: {
    product: { findMany: jest.fn() },
  },
}));
jest.mock('@core/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@features/products/variants.repository');

import { OrdersService } from '@features/orders/orders.service';
import { OrdersRepository } from '@features/orders/orders.repository';
import { CartRepository } from '@features/cart/cart.repository';
import { CouponsService } from '@features/coupons/coupons.service';
import { VariantsRepository } from '@features/products/variants.repository';
import { NotFoundError, ForbiddenError, ValidationError } from '@core/errors/http.errors';
import { prisma } from '@core/database/client';

const mockProductFindMany = prisma.product.findMany as jest.Mock;

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
      totalCents: 7995,
      shippingCents: 995,
      discountCents: 0,
      couponCode: null,
      status: 'pending',
      transactionKey: null,
      shippingAddress: { firstName: 'Alice', lastName: 'Dupont', city: 'Paris' },
      billingAddress: null,
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
      findGuestByOrderNumberAndEmail: jest.fn(),
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



  describe('lookupGuestOrder', () => {
    it('returns the order when the number and email match', async () => {
      const order = makeOrderFixture({
        userId: null,
        guestEmail: 'guest@example.com',
        orderNumber: 'BLP-2026-0001',
      });
      ordersRepository.findGuestByOrderNumberAndEmail.mockResolvedValueOnce(order as any);

      const result = await service.lookupGuestOrder('BLP-2026-0001', 'guest@example.com');

      expect(result.orderNumber).toBe('BLP-2026-0001');
      expect(result.guestEmail).toBe('guest@example.com');
      expect(ordersRepository.findGuestByOrderNumberAndEmail).toHaveBeenCalledWith(
        'BLP-2026-0001',
        'guest@example.com',
      );
    });

    it('throws NotFoundError when the email does not match the order', async () => {
      ordersRepository.findGuestByOrderNumberAndEmail.mockResolvedValueOnce(null);

      await expect(
        service.lookupGuestOrder('BLP-2026-0001', 'wrong@example.com'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllOrders', () => {
    it('returns the paginated admin order list', async () => {
      ordersRepository.findAll.mockResolvedValueOnce({
        items: [makeOrderFixture({ id: 'ord_001' }), makeOrderFixture({ id: 'ord_002' })],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1,
      } as any);

      const result = await service.getAllOrders({ page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(ordersRepository.findAll).toHaveBeenCalledWith({ page: 1, perPage: 20 });
    });
  });

  describe('getOrderTimeline', () => {
    it('returns the status history when the requester owns the order', async () => {
      const order = makeOrderFixture();
      const history = [{ status: 'pending', note: 'Order placed', createdAt: new Date() }];
      ordersRepository.findById.mockResolvedValueOnce(order as any);
      ordersRepository.findStatusHistory.mockResolvedValueOnce(history as any);

      const result = await service.getOrderTimeline(userId, order.id, false);

      expect(result).toEqual(history);
      expect(ordersRepository.findStatusHistory).toHaveBeenCalledWith(order.id);
    });

    it('throws NotFoundError when the order does not exist', async () => {
      ordersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getOrderTimeline(userId, 'ord_missing', false),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for a non-owner, non-admin requester', async () => {
      const order = makeOrderFixture({ userId: 'usr_someone-else' });
      ordersRepository.findById.mockResolvedValueOnce(order as any);

      await expect(
        service.getOrderTimeline(userId, order.id, false),
      ).rejects.toThrow(ForbiddenError);
      expect(ordersRepository.findStatusHistory).not.toHaveBeenCalled();
    });
  });
});
