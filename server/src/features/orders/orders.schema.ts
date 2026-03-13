import { z } from 'zod';

export const CreateOrderSchema = z.object({
  firstName: z.string().min(1, 'First name is required.').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required.').max(100).trim(),
  phone: z.string().max(30).trim().optional(),
  addressLine1: z.string().min(1, 'Address is required.').max(200).trim(),
  addressLine2: z.string().max(200).trim().optional(),
  city: z.string().min(1, 'City is required.').max(100).trim(),
  postalCode: z.string().min(1, 'Postal code is required.').max(20).trim(),
  province: z.string().max(100).trim().optional(),
  country: z.string().min(1, 'Country is required.').max(100).trim(),
  couponCode: z.string().max(50).trim().toUpperCase().optional(),
}).strict();

export const OrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], {
    required_error: 'A valid order status is required.',
  }),
}).strict();

export const OrderParamsSchema = z.object({
  id: z.string().uuid('A valid order ID is required.'),
});
