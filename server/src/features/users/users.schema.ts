import { z } from 'zod';

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  email: z.string().email('A valid email address is required.').max(254).toLowerCase().trim().optional(),
}).strict();

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z
    .string()
    .min(12, 'New password must be at least 12 characters long.')
    .max(128, 'New password must not exceed 128 characters.')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'New password must contain at least one number.'),
}).strict();
