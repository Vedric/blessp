jest.mock('@core/queue/queue.client', () => ({
  getEmailQueue: jest.fn(),
}));

jest.mock('@features/orders/order.emails', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
}));

import { enqueueOrderConfirmationEmail, type OrderConfirmationJobData } from '@core/queue/email.producer';
import { getEmailQueue } from '@core/queue/queue.client';
import { sendOrderConfirmation } from '@features/orders/order.emails';

const mockGetEmailQueue = getEmailQueue as jest.MockedFunction<typeof getEmailQueue>;
const mockSendOrderConfirmation = sendOrderConfirmation as jest.MockedFunction<typeof sendOrderConfirmation>;

function makeJobData(overrides: Partial<OrderConfirmationJobData> = {}): OrderConfirmationJobData {
  return {
    orderId: 'ord_test-123',
    customerEmail: 'test@example.com',
    customerName: 'Alice Dupont',
    items: [
      { name: 'Blessed Tee', quantity: 1, unitPriceCents: 3500, size: 'M', color: 'black' },
    ],
    subtotalCents: 3500,
    discountCents: 0,
    couponCode: null,
    totalCents: 3500,
    shippingAddress: { city: 'Paris', country: 'FR' },
    ...overrides,
  };
}

describe('enqueueOrderConfirmationEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues a job when the queue is available', async () => {
    const mockAdd = jest.fn().mockResolvedValue(undefined);
    mockGetEmailQueue.mockReturnValue({ add: mockAdd } as any);

    const data = makeJobData();
    await enqueueOrderConfirmationEmail(data);

    expect(mockAdd).toHaveBeenCalledWith('order-confirmation', data, { jobId: data.orderId });
    expect(mockSendOrderConfirmation).not.toHaveBeenCalled();
  });

  it('falls back to direct send when queue is unavailable', async () => {
    mockGetEmailQueue.mockReturnValue(null);

    const data = makeJobData();
    await enqueueOrderConfirmationEmail(data);

    expect(mockSendOrderConfirmation).toHaveBeenCalledWith(data);
  });

  it('uses orderId as the job idempotency key', async () => {
    const mockAdd = jest.fn().mockResolvedValue(undefined);
    mockGetEmailQueue.mockReturnValue({ add: mockAdd } as any);

    const data = makeJobData({ orderId: 'ord_unique-456' });
    await enqueueOrderConfirmationEmail(data);

    expect(mockAdd).toHaveBeenCalledWith(
      'order-confirmation',
      expect.anything(),
      expect.objectContaining({ jobId: 'ord_unique-456' }),
    );
  });
});
