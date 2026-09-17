import crypto from 'node:crypto';
import { Env } from '../config/env';

export const hashToken = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

// Independent key: rotating JWT keys must not make authenticator secrets unreadable.
function encryptionKey(): Buffer {
  if (Env.MFA_ENCRYPTION_KEY) return Buffer.from(Env.MFA_ENCRYPTION_KEY, 'base64');
  if (Env.NODE_ENV === 'production') throw new Error('MFA_ENCRYPTION_KEY is required');
  return crypto.createHash('sha256').update(Env.JWT_PRIVATE_KEY_BASE64).digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(value: string): string {
  // Legacy rows are encrypted by maintenance; see the migration runbook.
  if (!value.startsWith('v1:')) return value;
  const parts = value.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted factor format');
  const [, iv, tag, ciphertext] = parts;
  const nonce = Buffer.from(iv, 'base64');
  if (nonce.length !== 12) throw new Error('Invalid encrypted factor nonce');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), nonce, { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
