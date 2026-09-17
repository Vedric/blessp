/**
 * This file must be loaded before any application module is imported.
 * It sets required environment variables for the test environment,
 * generating ephemeral RSA keys for JWT signing.
 */
import crypto from 'crypto';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/blessp_test';
process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey).toString('base64');
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_integration_tests';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_placeholder';

// Separate schemas let integration suites run concurrently without deleting
// each other's fixtures. Never inherit provider credentials in tests.
const databaseUrl = new URL(process.env.DATABASE_URL!);
if (process.env.JEST_WORKER_ID) databaseUrl.searchParams.set('schema', `test_${process.env.JEST_WORKER_ID}`);
process.env.DATABASE_URL = databaseUrl.toString();
process.env.REDIS_URL = '';
process.env.RESEND_API_KEY = '';
process.env.POSTMARK_API_KEY = '';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_for_integration_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_placeholder';
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.OTEL_ENABLED = 'false';

process.env.SUPPORT_EMAIL = 'support@example.invalid';
delete process.env.SHIPPING_RATES_JSON;
for (const key of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_ENVIRONMENT']) delete process.env[key];
