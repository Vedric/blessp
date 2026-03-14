import { z } from 'zod';

export const CreatePaymentIntentSchema = z.object({
  orderId: z.string().uuid('A valid order ID is required.'),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code.').default('cad'),
}).strict();
