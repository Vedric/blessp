import { z } from 'zod';

export const AddToCartSchema = z.object({
  productId: z.string().uuid('A valid product ID is required.'),
  quantity: z.number().int().positive('Quantity must be at least 1.').max(99, 'Quantity must not exceed 99.'),
  size: z.string().max(20).trim().optional(),
  color: z.string().max(50).trim().optional(),
}).strict();

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1.').max(99, 'Quantity must not exceed 99.'),
}).strict();

export const CartItemParamsSchema = z.object({
  itemId: z.string().uuid('A valid cart item ID is required.'),
});
