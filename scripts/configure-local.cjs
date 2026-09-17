// Creates missing development configuration only; existing values are preserved.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const dotenv = require('../server/node_modules/dotenv');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.existsSync(path.join(root, name)) ? dotenv.parse(fs.readFileSync(path.join(root, name))) : {};
const rootEnv = read('.env');
const serverEnv = read('server/.env');
if (serverEnv.NODE_ENV === 'production') throw new Error('Local setup refuses a production environment.');
const existingUrl = serverEnv.DATABASE_URL ? new URL(serverEnv.DATABASE_URL) : null;
if (existingUrl && !['localhost', '127.0.0.1'].includes(existingUrl.hostname)) throw new Error('Local setup refuses a remote database.');
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const dbUser = rootEnv.POSTGRES_USER || (existingUrl && decodeURIComponent(existingUrl.username)) || 'blessp';
const dbPassword = rootEnv.POSTGRES_PASSWORD || (existingUrl && decodeURIComponent(existingUrl.password)) || crypto.randomBytes(24).toString('hex');
const dbName = rootEnv.POSTGRES_DB || (existingUrl && existingUrl.pathname.slice(1)) || 'blessp';
const common = {
  JWT_PRIVATE_KEY_BASE64: rootEnv.JWT_PRIVATE_KEY_BASE64 || serverEnv.JWT_PRIVATE_KEY_BASE64 || Buffer.from(keys.privateKey).toString('base64'),
  JWT_PUBLIC_KEY_BASE64: rootEnv.JWT_PUBLIC_KEY_BASE64 || serverEnv.JWT_PUBLIC_KEY_BASE64 || Buffer.from(keys.publicKey).toString('base64'),
  MFA_ENCRYPTION_KEY: rootEnv.MFA_ENCRYPTION_KEY || serverEnv.MFA_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64'),
};
function appendMissing(name, current, defaults) {
  const file = path.join(root, name);
  const missing = Object.entries(defaults).filter(([key]) => !(key in current));
  if (!missing.length) return;
  const text = '\n' + missing.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n';
  fs.appendFileSync(file, text, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log(`Configured missing fields in ${name}; existing values preserved.`);
}
appendMissing('.env', rootEnv, { POSTGRES_USER: dbUser, POSTGRES_PASSWORD: dbPassword, POSTGRES_DB: dbName, ...common });
appendMissing('server/.env', serverEnv, { DATABASE_URL: `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@localhost:5433/${dbName}?schema=public`, NODE_ENV: 'development', PORT: '3000', LOG_LEVEL: 'info', CLIENT_URL: 'http://localhost:5173', CORS_ALLOWED_ORIGINS: 'http://localhost:5173', REDIS_URL: 'redis://localhost:6379', OTEL_ENABLED: 'false', ...common });
