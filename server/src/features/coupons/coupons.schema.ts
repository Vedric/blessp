import { z } from 'zod';

export const CreateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required.').max(50).trim().toUpperCase(),
  discountType: z.enum(['percentage', 'fixed'], {
    required_error: 'Discount type must be "percentage" or "fixed".',
  }),
  discountValue: z.number().int().positive('Discount value must be a positive integer.'),
  minOrderCents: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
}).strict();

export const ValidateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required.').max(50).trim().toUpperCase(),
  orderTotalCents: z.number().int().positive('Order total must be a positive integer.'),
}).strict();

export const ApplyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required.').max(50).trim().toUpperCase(),
  orderTotalCents: z.number().int().positive('Order total must be a positive integer.'),
}).strict();

export const UpdateCouponSchema = z.object({
  isActive: z.boolean().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict();

export const CouponParamsSchema = z.object({
  id: z.string().uuid('A valid coupon ID is required.'),
});
