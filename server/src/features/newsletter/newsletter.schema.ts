import { z } from 'zod';

export const NewsletterSubscribeSchema = z.object({
  consent: z.literal(true),
  email: z.string().email('A valid email address is required.').max(254).toLowerCase().trim(),
}).strict();

export const NewsletterUnsubscribeSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
