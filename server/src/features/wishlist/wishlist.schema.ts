import { z } from 'zod';

export const AddToWishlistSchema = z.object({
  productId: z.string().uuid('A valid product ID is required.'),
}).strict();

export const WishlistProductParamsSchema = z.object({
  productId: z.string().uuid('A valid product ID is required.'),
});
