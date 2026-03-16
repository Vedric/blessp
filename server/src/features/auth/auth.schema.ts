import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('A valid email address is required.').max(254).toLowerCase().trim(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long.')
    .max(128, 'Password must not exceed 128 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
  firstName: z.string().min(1, 'First name is required.').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required.').max(100).trim(),
});

export const LoginSchema = z.object({
  email: z.string().email('A valid email address is required.').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required.'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
});

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required.'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('A valid email address is required.').toLowerCase().trim(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long.')
    .max(128, 'Password must not exceed 128 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
});

export const GoogleOAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required.'),
});

export const AppleOAuthSchema = z.object({
  idToken: z.string().min(1, 'Apple ID token is required.'),
  firstName: z.string().max(100).trim().optional(),
  lastName: z.string().max(100).trim().optional(),
});
