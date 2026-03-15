jest.mock('@core/database/client', () => ({
  prisma: {
    stripeCustomer: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  },
}));
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
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  paymentMethods: {
    list: jest.fn(),
    attach: jest.fn(),
    detach: jest.fn(),
    retrieve: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
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
import { prisma } from '@core/database/client';

jest.mock('@features/orders/orders.repository');

const mockStripeCustomerFindUnique = prisma.stripeCustomer.findUnique as jest.Mock;
const mockStripeCustomerCreate = (prisma.stripeCustomer as any).create as jest.Mock;

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

  describe('getOrCreateStripeCustomer', () => {
    it('returns the existing Stripe customer ID when one exists', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_existing',
      });

      const result = await service.getOrCreateStripeCustomer(userId, 'buyer@example.com');

      expect(result).toBe('cus_existing');
      expect(mockStripeInstance.customers.create).not.toHaveBeenCalled();
    });

    it('creates a new Stripe customer and stores the mapping when none exists', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce(null);
      mockStripeInstance.customers.create.mockResolvedValueOnce({ id: 'cus_new_123' });
      mockStripeCustomerCreate.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_new_123',
      });

      const result = await service.getOrCreateStripeCustomer(userId, 'buyer@example.com');

      expect(result).toBe('cus_new_123');
      expect(mockStripeInstance.customers.create).toHaveBeenCalledWith({
        email: 'buyer@example.com',
        metadata: { userId },
      });
      expect(mockStripeCustomerCreate).toHaveBeenCalledWith({
        data: {
          userId,
          stripeCustomerId: 'cus_new_123',
        },
      });
    });
  });

  describe('listPaymentMethods', () => {
    it('returns a formatted list of payment methods from Stripe', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_existing',
      });
      mockStripeInstance.customers.retrieve.mockResolvedValueOnce({
        id: 'cus_existing',
        invoice_settings: {
          default_payment_method: 'pm_default',
        },
      });
      mockStripeInstance.paymentMethods.list.mockResolvedValueOnce({
        data: [
          {
            id: 'pm_default',
            card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2028 },
          },
          {
            id: 'pm_other',
            card: { brand: 'mastercard', last4: '5555', exp_month: 6, exp_year: 2027 },
          },
        ],
      });

      const result = await service.listPaymentMethods(userId, 'buyer@example.com');

      expect(result).toEqual([
        {
          id: 'pm_default',
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2028,
          isDefault: true,
        },
        {
          id: 'pm_other',
          brand: 'mastercard',
          last4: '5555',
          expMonth: 6,
          expYear: 2027,
          isDefault: false,
        },
      ]);
    });

    it('returns an empty array when the customer has no payment methods', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_empty',
      });
      mockStripeInstance.customers.retrieve.mockResolvedValueOnce({
        id: 'cus_empty',
        invoice_settings: {
          default_payment_method: null,
        },
      });
      mockStripeInstance.paymentMethods.list.mockResolvedValueOnce({ data: [] });

      const result = await service.listPaymentMethods(userId, 'buyer@example.com');

      expect(result).toEqual([]);
    });
  });

  describe('attachPaymentMethod', () => {
    it('attaches a payment method to an existing Stripe customer', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_existing',
      });
      mockStripeInstance.paymentMethods.attach.mockResolvedValueOnce({
        id: 'pm_new',
        card: { brand: 'visa', last4: '1234', exp_month: 3, exp_year: 2029 },
      });

      const result = await service.attachPaymentMethod(userId, 'buyer@example.com', 'pm_new');

      expect(result).toEqual({
        id: 'pm_new',
        brand: 'visa',
        last4: '1234',
        expMonth: 3,
        expYear: 2029,
        isDefault: false,
      });
      expect(mockStripeInstance.paymentMethods.attach).toHaveBeenCalledWith('pm_new', {
        customer: 'cus_existing',
      });
    });

    it('creates a Stripe customer first if none exists, then attaches', async () => {
      // First call (from getOrCreateStripeCustomer): no customer found
      mockStripeCustomerFindUnique.mockResolvedValueOnce(null);
      mockStripeInstance.customers.create.mockResolvedValueOnce({ id: 'cus_new' });
      mockStripeCustomerCreate.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_new',
      });
      mockStripeInstance.paymentMethods.attach.mockResolvedValueOnce({
        id: 'pm_attached',
        card: { brand: 'amex', last4: '9999', exp_month: 11, exp_year: 2030 },
      });

      const result = await service.attachPaymentMethod(userId, 'buyer@example.com', 'pm_attached');

      expect(result.id).toBe('pm_attached');
      expect(mockStripeInstance.customers.create).toHaveBeenCalled();
      expect(mockStripeInstance.paymentMethods.attach).toHaveBeenCalledWith('pm_attached', {
        customer: 'cus_new',
      });
    });
  });

  describe('detachPaymentMethod', () => {
    it('throws NotFoundError when the user has no Stripe customer', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.detachPaymentMethod(userId, 'pm_orphan'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the payment method does not belong to the user', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_mine',
      });
      mockStripeInstance.paymentMethods.retrieve.mockResolvedValueOnce({
        id: 'pm_theirs',
        customer: 'cus_someone_else',
      });

      await expect(
        service.detachPaymentMethod(userId, 'pm_theirs'),
      ).rejects.toThrow(ForbiddenError);
      expect(mockStripeInstance.paymentMethods.detach).not.toHaveBeenCalled();
    });

    it('detaches the payment method on success', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_mine',
      });
      mockStripeInstance.paymentMethods.retrieve.mockResolvedValueOnce({
        id: 'pm_mine',
        customer: 'cus_mine',
      });
      mockStripeInstance.paymentMethods.detach.mockResolvedValueOnce({ id: 'pm_mine' });

      await service.detachPaymentMethod(userId, 'pm_mine');

      expect(mockStripeInstance.paymentMethods.detach).toHaveBeenCalledWith('pm_mine');
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('throws NotFoundError when the user has no Stripe customer', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.setDefaultPaymentMethod(userId, 'pm_any'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when the payment method does not belong to the user', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_mine',
      });
      mockStripeInstance.paymentMethods.retrieve.mockResolvedValueOnce({
        id: 'pm_theirs',
        customer: 'cus_someone_else',
      });

      await expect(
        service.setDefaultPaymentMethod(userId, 'pm_theirs'),
      ).rejects.toThrow(ForbiddenError);
      expect(mockStripeInstance.customers.update).not.toHaveBeenCalled();
    });

    it('sets the default payment method on the Stripe customer', async () => {
      mockStripeCustomerFindUnique.mockResolvedValueOnce({
        userId,
        stripeCustomerId: 'cus_mine',
      });
      mockStripeInstance.paymentMethods.retrieve.mockResolvedValueOnce({
        id: 'pm_preferred',
        customer: 'cus_mine',
      });
      mockStripeInstance.customers.update.mockResolvedValueOnce({ id: 'cus_mine' });

      await service.setDefaultPaymentMethod(userId, 'pm_preferred');

      expect(mockStripeInstance.customers.update).toHaveBeenCalledWith('cus_mine', {
        invoice_settings: {
          default_payment_method: 'pm_preferred',
        },
      });
    });
  });

  describe('refundOrder', () => {
    it('throws NotFoundError when order does not exist', async () => {
      ordersRepository.findById.mockResolvedValueOnce(null);

      await expect(service.refundOrder('ord_missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when order has no transaction key', async () => {
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ transactionKey: null }) as any,
      );

      await expect(service.refundOrder(orderId)).rejects.toThrow(ValidationError);
    });

    it('creates a Stripe refund and returns the refund details', async () => {
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ transactionKey: 'pi_charged', totalCents: 5000 }) as any,
      );
      mockStripeInstance.refunds.create.mockResolvedValueOnce({
        id: 're_test_001',
        amount: 5000,
      });

      const result = await service.refundOrder(orderId, 'Defective item');

      expect(result).toEqual({ refundId: 're_test_001', amountRefunded: 5000 });
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_charged',
        reason: 'requested_by_customer',
        metadata: {
          orderId,
          internalReason: 'Defective item',
        },
      });
    });

    it('uses a default reason when none is provided', async () => {
      ordersRepository.findById.mockResolvedValueOnce(
        makeOrderFixture({ transactionKey: 'pi_charged' }) as any,
      );
      mockStripeInstance.refunds.create.mockResolvedValueOnce({
        id: 're_test_002',
        amount: 5000,
      });

      await service.refundOrder(orderId);

      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            internalReason: 'Admin-initiated refund',
          }),
        }),
      );
    });
  });
});
