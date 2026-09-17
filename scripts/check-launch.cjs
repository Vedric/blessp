// Read-only launch review: never print credential values or contact providers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const configAt = args.indexOf('--config');
const file = configAt >= 0 ? path.resolve(args[configAt + 1] || '') : path.join(root, 'config/launch.json');
const staticOnly = args.includes('--static');
const staging = args.includes('--staging');
const blockers = [];
const reject = message => blockers.push(message);
const realUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash && !/(^|\.)(localhost|example\.(com|org|net))$|\.(invalid|test)$/.test(u.hostname) && u.hostname.includes('.'); } catch { return false; } };
let config;
try { config = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch { reject('Create and complete config/launch.json from config/launch.example.json.'); }
if (config) {
  for (const field of ['country', 'province', 'legalName', 'registration', 'address', 'supportEmail']) {
    if (typeof config.company?.[field] !== 'string' || !config.company[field].trim()) reject(`Company information missing: ${field}.`);
  }
  if (!realUrl(config.publicUrl)) reject('Set the real HTTPS publicUrl.');
  const required = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'config/launch.example.json'), 'utf8')).reviews);
  for (const item of required) if (config.reviews?.[item] !== true) reject(`Review not completed: ${item}.`);
}
for (const lang of ['en', 'fr']) {
  const content = fs.readFileSync(path.join(root, `client/src/i18n/locales/${lang}.json`), 'utf8');
  if (/\[(?:À compléter|To be completed)/i.test(content)) reject(`Unfinished public legal information in ${lang}.`);
}
if (!staticOnly) {
  const env = process.env;
  const required = ['DATABASE_URL', 'JWT_PRIVATE_KEY_BASE64', 'JWT_PUBLIC_KEY_BASE64', 'MFA_ENCRYPTION_KEY', 'METRICS_TOKEN', 'CLIENT_URL', 'CORS_ALLOWED_ORIGINS', 'SUPPORT_EMAIL', 'EMAIL_FROM', 'SHIPPING_RATES_JSON', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'VITE_STRIPE_PUBLISHABLE_KEY'];
  for (const name of required) if (!env[name]?.trim()) reject(`Environment value missing: ${name}.`);
  if (!env.RESEND_API_KEY && !env.POSTMARK_API_KEY) reject('Configure an outbound email provider.');
  if (!realUrl(env.CLIENT_URL)) reject('CLIENT_URL must identify the real HTTPS storefront.');
  if (config?.publicUrl && env.CLIENT_URL && config.publicUrl.replace(/\/$/, '') !== env.CLIENT_URL.replace(/\/$/, '')) reject('CLIENT_URL differs from the reviewed publicUrl.');
  if (config?.company?.supportEmail && env.SUPPORT_EMAIL !== config.company.supportEmail) reject('SUPPORT_EMAIL differs from the reviewed mailbox.');
  if ((env.CORS_ALLOWED_ORIGINS || '').split(',').some(origin => !realUrl(origin.trim()))) reject('Review CORS origins: HTTPS storefront origins are required.');
  const mode = staging ? 'test' : 'live';
  const paypal = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'];
  if (paypal.some(name => env[name])) {
    for (const name of paypal) if (!env[name]?.trim()) reject(`PayPal value missing: ${name}.`);
    if ((env.PAYPAL_ENVIRONMENT || 'sandbox') !== (staging ? 'sandbox' : 'live')) reject('PayPal environment does not match the release environment.');
  }
  for (const provider of ['GOOGLE', 'APPLE']) {
    const publicId = env[`VITE_${provider}_CLIENT_ID`];
    const serverId = env[`${provider}_CLIENT_ID`];
    if ((publicId || serverId) && (!publicId || publicId !== serverId)) reject(`${provider} client and server audiences must match.`);
  }
  if (!env.STRIPE_SECRET_KEY?.startsWith(`sk_${mode}_`) || !env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith(`pk_${mode}_`)) reject(`Use matching Stripe ${mode} secret/public key modes.`);
  try {
    const privateKey = crypto.createPrivateKey(Buffer.from(env.JWT_PRIVATE_KEY_BASE64 || '', 'base64'));
    const actualPublic = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
    const configuredPublic = crypto.createPublicKey(Buffer.from(env.JWT_PUBLIC_KEY_BASE64 || '', 'base64')).export({ type: 'spki', format: 'pem' });
    if (privateKey.asymmetricKeyType !== 'rsa' || actualPublic !== configuredPublic) reject('JWT RSA keys do not form a matching pair.');
  } catch { reject('JWT RSA keys could not be validated.'); }
  if (Buffer.from(env.MFA_ENCRYPTION_KEY || '', 'base64').length !== 32) reject('MFA encryption key must encode 32 bytes.');
  if ((env.METRICS_TOKEN || '').length < 32) reject('Metrics token is too short.');
  try {
    const rates = JSON.parse(env.SHIPPING_RATES_JSON);
    const seen = new Set();
    if (!Array.isArray(rates) || !rates.length || rates.length > 250) throw new Error();
    for (const rate of rates) {
      if (!/^[A-Z]{2}$/.test(rate.country) || seen.has(rate.country) || !Number.isInteger(rate.feeCents) || rate.feeCents < 0 || rate.feeCents > 1000000 || (rate.freeThresholdCents !== null && (!Number.isInteger(rate.freeThresholdCents) || rate.freeThresholdCents < 0 || rate.freeThresholdCents > 100000000))) throw new Error();
      seen.add(rate.country);
    }
  } catch { reject('Shipping rates are missing or invalid.'); }
}
console.log(JSON.stringify({ ready: blockers.length === 0, scope: staticOnly ? 'repository-review' : staging ? 'staging-config' : 'live-config', blockers, note: 'This check does not prove provider delivery, tax correctness, infrastructure security or production availability.' }, null, 2));
process.exitCode = blockers.length ? 1 : 0;
