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
  // Either a 6-digit TOTP code from the authenticator app, or a single-use
  // backup code (formatted roughly as XXXXX-XXXXX). The service decides.
  mfaToken: z.string().min(6).max(20).trim().optional(),
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

export const EmailTokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export const GoogleOAuthSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  mfaToken: z.string().min(6).max(20).optional(),
  idToken: z.string().min(1, 'Google access token is required.').max(16384),
}).strict();

export const AppleOAuthSchema = z.object({
  mfaToken: z.string().min(6).max(20).optional(),
  idToken: z.string().min(1, 'Apple ID token is required.').max(16384),
  firstName: z.string().max(100).trim().optional(),
  lastName: z.string().max(100).trim().optional(),
}).strict();
