import { getEmailQueue } from './queue.client';
import { sendOrderConfirmation } from '../../features/orders/order.emails';
import { logger } from '../observability/logger';

export interface OrderConfirmationJobData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    size?: string;
    color?: string;
  }>;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  totalCents: number;
  shippingAddress: {
    city: string;
    province?: string;
    country: string;
  };
}

export async function enqueueOrderConfirmationEmail(
  data: OrderConfirmationJobData,
): Promise<void> {
  const queue = getEmailQueue();

  if (queue) {
    await queue.add('order-confirmation', data, {
      jobId: data.orderId,
    });
    logger.info({ orderId: data.orderId }, 'Order confirmation email enqueued');
    return;
  }

  // Fallback: send directly when Redis is not available
  logger.warn(
    { orderId: data.orderId },
    'Redis unavailable, sending order confirmation email synchronously',
  );
  sendOrderConfirmation(data).catch((err) => {
    logger.error(
      { err, orderId: data.orderId },
      'Failed to send order confirmation email (fallback)',
    );
  });
}
