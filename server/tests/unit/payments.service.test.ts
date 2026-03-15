jest.mock('@core/database/client', () => ({ prisma: {} }));
jest.mock('@core/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@core/config/env', () => ({
  Env: {
    STRIPE_SECRET_KEY: 'sk_test_fake',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_fake',
    JWT_PRIVATE_KEY_BASE64: Buffer.from('fake').toString('base64'),
    JWT_PUBLIC_KEY_BASE64: Buffer.from('fake').toString('base64'),
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
  },
}));
jest.mock('@core/observability/tracer', () => ({
  getTracer: () => ({
    startSpan: () => ({
      setAttribute: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    }),
  }),
}));

const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});
jest.mock('@features/loyalty/loyalty.service', () => ({
  LoyaltyService: jest.fn().mockImplementation(() => ({
    awardPointsForOrder: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('@features/loyalty/loyalty.repository');

import { PaymentsService } from '@features/payments/payments.service';
import { OrdersRepository } from '@features/orders/orders.repository';
import { NotFoundError, ForbiddenError, ValidationError } from '@core/errors/http.errors';

jest.mock('@features/orders/orders.repository');

describe('PaymentsService', () => {
  let service: PaymentsService;
  let ordersRepository: jest.Mocked<OrdersRepository>;

  const userId = 'usr_buyer';
  const orderId = 'ord_001';

  function makeOrderFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: orderId,
      userId,
      status: 'pending',
      totalCents: 5000,
      transactionKey: null,
      items: [],
      createdAt: new Date('2026-01-15T10:00:00Z'),
      updatedAt: new Date('2026-01-15T10:00:00Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    ordersRepository = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
      updateTransactionKey: jest.fn(),
    } as unknown as jest.Mocked<OrdersRepository>;

    service = new PaymentsService(ordersRepository);
  });

  describe('createPaymentIntent', () => {
    it('throws NotFoundError when order is not found', async () => {
      ordersRepository.findById.mockResolvedValueOnce(null);

      await expect(service.createPaymentIntent(userId, orderId)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when user does not own the order', async () => {
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ userId: 'usr_other' }) as any,
      );

      await expect(service.createPaymentIntent(userId, orderId)).rejects.toThrow(ForbiddenError);
    });

    it('throws ValidationError when order status is not pending', async () => {
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ status: 'paid' }) as any,
      );

      await expect(service.createPaymentIntent(userId, orderId)).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when totalCents is zero', async () => {
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ totalCents: 0 }) as any,
      );

      await expect(service.createPaymentIntent(userId, orderId)).rejects.toThrow(ValidationError);
    });

    it('creates payment intent and returns response on success', async () => {
      ordersRepository.findById.mockResolvedValueOnce(makeOrderFixture() as any);
      mockStripeInstance.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        amount: 5000,
        currency: 'eur',
      });
      ordersRepository.updateTransactionKey.mockResolvedValueOnce(undefined as any);

      const result = await service.createPaymentIntent(userId, orderId);

      expect(result).toEqual({
        clientSecret: 'pi_test_123_secret',
        paymentIntentId: 'pi_test_123',
        amount: 5000,
        currency: 'eur',
      });
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'eur',
        metadata: { orderId, userId },
      });
      expect(ordersRepository.updateTransactionKey).toHaveBeenCalledWith(orderId, 'pi_test_123');
    });

    it('returns existing intent if order already has a transactionKey (idempotency)', async () => {
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ transactionKey: 'pi_existing' }) as any,
      );
      mockStripeInstance.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_existing',
        client_secret: 'pi_existing_secret',
        amount: 5000,
        currency: 'eur',
        status: 'requires_payment_method',
      });

      const result = await service.createPaymentIntent(userId, orderId);

      expect(result).toEqual({
        clientSecret: 'pi_existing_secret',
        paymentIntentId: 'pi_existing',
        amount: 5000,
        currency: 'eur',
      });
      expect(mockStripeInstance.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    const rawBody = Buffer.from('test_body');
    const signature = 'test_sig';

    it('throws ValidationError on invalid signature', async () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      await expect(service.handleWebhook(rawBody, signature)).rejects.toThrow(ValidationError);
    });

    it('updates order to paid on payment_intent.succeeded', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValueOnce({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: { orderId },
          },
        },
      });
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ status: 'pending' }) as any,
      );
      ordersRepository.updateStatus.mockResolvedValueOnce(undefined as any);

      await service.handleWebhook(rawBody, signature);

      expect(ordersRepository.updateStatus).toHaveBeenCalledWith(orderId, 'paid');
    });

    it('skips duplicate webhook for already-paid order', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValueOnce({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: { orderId },
          },
        },
      });
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ status: 'paid' }) as any,
      );

      await service.handleWebhook(rawBody, signature);

      expect(ordersRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('updates order to cancelled on payment_intent.payment_failed', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValueOnce({
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: { orderId },
          },
        },
      });
      ordersRepository.updateStatus.mockResolvedValueOnce(undefined as any);

      await service.handleWebhook(rawBody, signature);

      expect(ordersRepository.updateStatus).toHaveBeenCalledWith(orderId, 'cancelled');
    });

    it('handles charge.refunded event', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValueOnce({
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_test_123',
            amount_refunded: 5000,
            metadata: { orderId },
          },
        },
      });
      ordersRepository.updateStatus.mockResolvedValueOnce(undefined as any);

      await service.handleWebhook(rawBody, signature);

      expect(ordersRepository.updateStatus).toHaveBeenCalledWith(orderId, 'cancelled');
    });
  });
});
