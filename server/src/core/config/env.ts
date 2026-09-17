import 'dotenv/config';
import { z } from 'zod';
import { ShippingRatesJsonSchema } from './commerce.schema';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_PRIVATE_KEY_BASE64: z.string().min(1, 'JWT_PRIVATE_KEY_BASE64 is required'),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1, 'JWT_PUBLIC_KEY_BASE64 is required'),
  MFA_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'Must encode 32 random bytes').optional(),
  TRUST_PROXY: z.string().default(''),
  METRICS_TOKEN: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRY: z.string().regex(/^\d+[smhd]$/).default('15m'),
  JWT_REFRESH_EXPIRY: z.string().regex(/^\d+[smhd]$/).default('7d'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  PAYPAL_CLIENT_ID: z.string().trim().transform(value => value || undefined).optional(),
  PAYPAL_CLIENT_SECRET: z.string().trim().transform(value => value || undefined).optional(),
  PAYPAL_WEBHOOK_ID: z.string().trim().transform(value => value || undefined).optional(),
  PAYPAL_ENVIRONMENT: z.enum(['sandbox', 'live']).default('sandbox'),

  SERVICE_NAME: z.string().default('blessp-api'),
  SERVICE_VERSION: z.string().default('3.0.0'),

  REDIS_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  EMAIL_FROM: z.string().optional(),
  SUPPORT_EMAIL: z.string().trim().email().optional(),
  SHIPPING_RATES_JSON: ShippingRatesJsonSchema.optional(),
  RESEND_API_KEY: z.string().optional(),
  POSTMARK_API_KEY: z.string().optional(),
  POSTMARK_STREAM: z.string().default('outbound'),

  OTEL_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

function loadEnv(): EnvConfig {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.format();
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  const paypal = [parsed.data.PAYPAL_CLIENT_ID, parsed.data.PAYPAL_CLIENT_SECRET, parsed.data.PAYPAL_WEBHOOK_ID];
  if (paypal.some(Boolean) && !paypal.every(Boolean)) {
    // eslint-disable-next-line no-console
    console.error('PayPal requires CLIENT_ID, CLIENT_SECRET and WEBHOOK_ID together.');
    process.exit(1);
  }

  // Production environments must have Stripe credentials configured.
  // We keep them optional in development and test so local startup does not
  // require Stripe setup for unrelated features.
  if (parsed.data.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!parsed.data.SUPPORT_EMAIL) missing.push('SUPPORT_EMAIL');
    if (!parsed.data.SHIPPING_RATES_JSON) missing.push('SHIPPING_RATES_JSON');
    if (!parsed.data.MFA_ENCRYPTION_KEY) missing.push('MFA_ENCRYPTION_KEY');
    if (!parsed.data.METRICS_TOKEN) missing.push('METRICS_TOKEN');
    if (!process.env.CLIENT_URL || !parsed.data.CLIENT_URL.startsWith('https://')) missing.push('CLIENT_URL (HTTPS)');
    if (!process.env.CORS_ALLOWED_ORIGINS) missing.push('CORS_ALLOWED_ORIGINS');
    if (!parsed.data.STRIPE_SECRET_KEY || parsed.data.STRIPE_SECRET_KEY.trim() === '') {
      missing.push('STRIPE_SECRET_KEY');
    }
    if (!parsed.data.STRIPE_WEBHOOK_SECRET || parsed.data.STRIPE_WEBHOOK_SECRET.trim() === '') {
      missing.push('STRIPE_WEBHOOK_SECRET');
    }
    if (!parsed.data.EMAIL_FROM || parsed.data.EMAIL_FROM.trim() === '') {
      missing.push('EMAIL_FROM');
    }
    if (!parsed.data.RESEND_API_KEY && !parsed.data.POSTMARK_API_KEY) {
      missing.push('RESEND_API_KEY or POSTMARK_API_KEY');
    }
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Invalid environment configuration: the following variables are required in production but are missing or empty: ${missing.join(', ')}`,
      );
      process.exit(1);
    }
  }

  return parsed.data;
}

export const Env = loadEnv();
