import { z } from 'zod';

// Billing details can legitimately differ from the shipping destination
// (gift orders, corporate cards), so we accept an optional snapshot that
// mirrors the shipping fields. When omitted, the shipping address stands
// in as the billing reference on the payment side.
const BillingAddressSchema = z.object({
  firstName: z.string().min(1, 'First name is required.').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required.').max(100).trim(),
  addressLine1: z.string().min(1, 'Address is required.').max(200).trim(),
  addressLine2: z.string().max(200).trim().optional(),
  city: z.string().min(1, 'City is required.').max(100).trim(),
  postalCode: z.string().min(1, 'Postal code is required.').max(20).trim(),
  province: z.string().max(100).trim().optional(),
  country: z.string().min(1, 'Country is required.').max(100).trim(),
  phone: z.string().max(30).trim().optional(),
}).strict();

export const CreateOrderSchema = z.object({
  locale: z.enum(['en', 'fr']).optional(),
  checkoutKey: z.string().uuid().optional(),
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
  billingAddress: BillingAddressSchema.optional(),
}).strict();

// Guest-checkout order creation. Identical to CreateOrderSchema plus the
// required email so the server can send confirmation and receipts without
// the buyer holding a registered account, and an explicit line items array
// since we cannot rely on a server-side session cart.
export const CreateGuestOrderSchema = CreateOrderSchema.extend({
  email: z.string().email('A valid email is required.').toLowerCase().trim().max(254),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive().max(100),
      size: z.string().max(20).trim().optional(),
      color: z.string().max(40).trim().optional(),
    }),
  ).min(1, 'Cart cannot be empty.').max(50),
}).strict();

export const OrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'paid', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'], {
    required_error: 'A valid order status is required.',
  }),
  note: z.string().max(500).trim().optional(),
}).strict();

export const OrderParamsSchema = z.object({
  id: z.string().uuid('A valid order ID is required.'),
});

export const GuestOrderLookupSchema = z.object({
  orderNumber: z.string().min(6).max(40).trim().toUpperCase(),
  email: z.string().email().toLowerCase().trim().max(254),
}).strict();
