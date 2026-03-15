import { z } from 'zod';

export const CreateContactMessageSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(100, 'Name must not exceed 100 characters.').trim(),
  email: z.string().email('A valid email address is required.').max(254).toLowerCase().trim(),
  subject: z.string().min(2, 'Subject must be at least 2 characters.').max(200, 'Subject must not exceed 200 characters.').trim(),
  message: z.string().min(10, 'Message must be at least 10 characters.').max(5000, 'Message must not exceed 5000 characters.').trim(),
}).strict();

export type CreateContactMessageDto = z.infer<typeof CreateContactMessageSchema>;
