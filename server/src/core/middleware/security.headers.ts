import { Request, Response, NextFunction } from 'express';
import { Env } from '../config/env';

/**
 * Content Security Policy tailored for the BLE$P SPA. The same Express
 * process serves both the API and the built client under /public, so the
 * CSP must cover Stripe.js (payment iframes), Google Sign-In (GSI script
 * and iframes), and Apple Sign-In, while still denying inline scripts and
 * framing from other origins.
 */
const CSP_DIRECTIVES: Array<[string, string]> = [
  ['default-src', "'self'"],
  [
    'script-src',
    [
      "'self'",
      'https://js.stripe.com',
      'https://accounts.google.com',
      'https://appleid.cdn-apple.com',
    ].join(' '),
  ],
  [
    'frame-src',
    [
      'https://js.stripe.com',
      'https://hooks.stripe.com',
      'https://accounts.google.com',
      'https://appleid.apple.com',
    ].join(' '),
  ],
  [
    'connect-src',
    [
      "'self'",
      'https://api.stripe.com',
      'https://oauth2.googleapis.com',
      'https://www.googleapis.com',
      'https://appleid.apple.com',
    ].join(' '),
  ],
  ['img-src', "'self' data: blob: https:"],
  ['style-src', "'self' 'unsafe-inline' https://fonts.googleapis.com"],
  ['font-src', "'self' data: https://fonts.gstatic.com"],
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
  ['frame-ancestors', "'none'"],
  ['upgrade-insecure-requests', ''],
];

const cspHeader = (production: boolean) => CSP_DIRECTIVES
  .filter(([name]) => production || name !== 'upgrade-insecure-requests')
  .map(([name, value]) => value ? `${name} ${value}` : name).join('; ');
const PRODUCTION_CSP = cspHeader(true);
const LOCAL_CSP = cspHeader(false);

/**
 * Sets security-related HTTP headers on every response.
 * These complement helmet's defaults with stricter policies tuned for
 * the payment and OAuth surfaces we ship.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  const production = Env.NODE_ENV === 'production';
  // WebKit upgrades even loopback subresources with this directive. Keep
  // HTTPS enforcement in production while allowing local HTTP development.
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  else res.removeHeader('Strict-Transport-Security');
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Content-Security-Policy': production ? PRODUCTION_CSP : LOCAL_CSP,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': [
      'accelerometer=()',
      'autoplay=(self)',
      'camera=()',
      'clipboard-read=()',
      'clipboard-write=(self)',
      'display-capture=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'hid=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=(self "https://js.stripe.com")',
      'picture-in-picture=()',
      'publickey-credentials-get=(self)',
      'serial=()',
      'sync-xhr=(self)',
      'usb=()',
      'xr-spatial-tracking=()',
    ].join(', '),
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-site',
  });
  next();
}
