import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_PRIVATE_KEY_BASE64: z.string().min(1, 'JWT_PRIVATE_KEY_BASE64 is required'),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1, 'JWT_PUBLIC_KEY_BASE64 is required'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  SERVICE_NAME: z.string().default('blessp-api'),
  SERVICE_VERSION: z.string().default('3.0.0'),

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

  return parsed.data;
}

export const Env = loadEnv();
