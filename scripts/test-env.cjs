// Isolated test process: do not load .env or contact configured external services.
const { generateKeyPairSync } = require('node:crypto');
const { spawn } = require('node:child_process');
const database = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/blessp_test');
if (!/_(test|audit|ci)$/.test(database.pathname)) throw new Error('Tests require an explicitly named test database.');
const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const env = { ...process.env, NODE_ENV: 'test', VITE_STRIPE_PUBLISHABLE_KEY: '', VITE_GOOGLE_CLIENT_ID: '', VITE_APPLE_CLIENT_ID: '', DOTENV_CONFIG_PATH: '/dev/null', DATABASE_URL: database.toString(), JWT_PRIVATE_KEY_BASE64: Buffer.from(keys.privateKey).toString('base64'), JWT_PUBLIC_KEY_BASE64: Buffer.from(keys.publicKey).toString('base64'), MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), STRIPE_SECRET_KEY: 'sk_test_isolated_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_isolated_placeholder', REDIS_URL: '', RESEND_API_KEY: '', POSTMARK_API_KEY: '', EMAIL_FROM: '', SUPPORT_EMAIL: 'support@example.invalid', SHIPPING_RATES_JSON: '', GOOGLE_CLIENT_ID: 'isolated-google-client', APPLE_CLIENT_ID: 'isolated-apple-client', ADMIN_EMAIL: 'e2e-admin@example.com', ADMIN_PASSWORD: 'E2EAdminPassword123!', OTEL_ENABLED: 'false', LOG_LEVEL: 'error', CLIENT_URL: 'http://127.0.0.1:3107', CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3107', PORT: '3107' };
delete env.SHIPPING_RATES_JSON;
for (const key of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_ENVIRONMENT']) delete env[key];
const child = spawn(process.argv[2], process.argv.slice(3), { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
