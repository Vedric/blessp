import { z } from 'zod';

export const NewsletterSubscribeSchema = z.object({
  email: z.string().email('A valid email address is required.').max(254).toLowerCase().trim(),
}).strict();

export const NewsletterUnsubscribeSchema = z.object({
  email: z.string().email('A valid email address is required.').max(254).toLowerCase().trim(),
}).strict();
