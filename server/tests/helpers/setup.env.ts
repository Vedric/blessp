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
