import { z } from 'zod';

export const CreateReviewSchema = z.object({
  productId: z.string().uuid('A valid product ID is required.'),
  rating: z.number().int().min(1, 'Rating must be at least 1.').max(5, 'Rating must be at most 5.'),
  title: z.string().trim().max(200, 'Title must be 200 characters or fewer.').optional(),
  comment: z.string().trim().max(2000, 'Comment must be 2000 characters or fewer.').optional(),
}).strict();

export const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be at least 1.').max(5, 'Rating must be at most 5.').optional(),
  title: z.string().trim().max(200, 'Title must be 200 characters or fewer.').optional(),
  comment: z.string().trim().max(2000, 'Comment must be 2000 characters or fewer.').optional(),
}).strict();

export const ReviewQuerySchema = z.object({
  productId: z.string().uuid('A valid product ID is required.'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export const ReviewParamsSchema = z.object({
  id: z.string().uuid('A valid review ID is required.'),
});

export const ProductIdParamsSchema = z.object({
  productId: z.string().uuid('A valid product ID is required.'),
});
