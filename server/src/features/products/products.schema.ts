import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required.').max(200).trim(),
  price: z.number().int('Price must be an integer (in cents).').positive('Price must be positive.'),
  description: z.string().max(2000).trim().optional(),
  details: z.string().max(5000).trim().optional(),
  picture: z.string().url('Picture must be a valid URL.').optional(),
  images: z.array(z.string().url('Each image must be a valid URL.')).max(20).optional(),
  category: z.string().max(100).trim().optional(),
  colors: z.array(z.string().max(50).trim()).max(30).optional(),
  sizes: z.array(z.string().max(20).trim()).max(20).optional(),
  isActive: z.boolean().optional(),
  onfrontOrder: z.number().int().nonnegative().optional(),
}).strict();

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  price: z.number().int('Price must be an integer (in cents).').positive('Price must be positive.').optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  details: z.string().max(5000).trim().nullable().optional(),
  picture: z.string().url('Picture must be a valid URL.').nullable().optional(),
  images: z.array(z.string().url('Each image must be a valid URL.')).max(20).optional(),
  category: z.string().max(100).trim().nullable().optional(),
  colors: z.array(z.string().max(50).trim()).max(30).optional(),
  sizes: z.array(z.string().max(20).trim()).max(20).optional(),
  isActive: z.boolean().optional(),
  onfrontOrder: z.number().int().nonnegative().nullable().optional(),
}).strict();

export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().max(100).trim().optional(),
  search: z.string().max(200).trim().optional(),
  sort: z.string().max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  colors: z.string().max(500).transform((val) => val.split(',').map((c) => c.trim()).filter(Boolean)).optional(),
  sizes: z.string().max(200).transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean)).optional(),
});

export const UpdateVariantsSchema = z.object({
  variants: z.array(
    z.object({
      size: z.string().min(1).max(20).trim(),
      color: z.string().min(1).max(50).trim(),
      stock: z.number().int('Stock must be an integer.').nonnegative('Stock cannot be negative.'),
      sku: z.string().max(100).trim().nullable().optional(),
    }),
  ).min(1, 'At least one variant is required.').max(200),
}).strict();
