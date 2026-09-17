import { z } from 'zod';

// Currency is deliberately not accepted from the client: orders are priced
// in CAD cents, so a client-chosen currency would let a buyer settle the
// same integer amount in a cheaper currency. See STORE_CURRENCY in the service.
export const CreatePaymentIntentSchema = z.object({
  orderId: z.string().uuid('A valid order ID is required.'),
}).strict();

export const CreateGuestPaymentIntentSchema = z.object({
  orderId: z.string().uuid('A valid order ID is required.'),
  email: z.string().email().toLowerCase().trim().max(254),
}).strict();

export const AttachPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'A valid payment method ID is required.').trim(),
}).strict();

export const RefundOrderSchema = z.object({
  orderId: z.string().uuid('A valid order ID is required.'),
  expectedRefundedCents: z.number().int().min(0).max(2147483647).optional(),
  reason: z.string().max(500).trim().optional(),
}).strict();
