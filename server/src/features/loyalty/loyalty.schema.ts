import { z } from 'zod';

export const RedeemPointsSchema = z.object({
  points: z.number()
    .int('Points must be a whole number.')
    .min(100, 'Minimum redemption is 100 points.'),
}).strict();

export const LoyaltyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
