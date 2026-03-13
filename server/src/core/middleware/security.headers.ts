import { Request, Response, NextFunction } from 'express';

/**
 * Sets security-related HTTP headers on every response.
 * These complement helmet's defaults with stricter policies.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Content-Security-Policy': "default-src 'none'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
}
