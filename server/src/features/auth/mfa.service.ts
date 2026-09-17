import crypto from 'crypto';
import { transaction, lockResource } from '../../core/database/transaction';
import { encryptSecret, decryptSecret } from '../../core/security/secrets';
import QRCode from 'qrcode';
import { prisma } from '../../core/database/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../core/errors/http.errors';
import { logger } from '../../core/observability/logger';
import { HashService } from '../../core/security/hash.service';

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BACKUP_CODE_LENGTH = 10;

function generateBackupCode(): string {
  const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
  let out = '';
  for (const b of bytes) out += BACKUP_CODE_ALPHABET[b % BACKUP_CODE_ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

function normaliseBackupCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

// RFC 6238 TOTP: 30-second step, 6 digits, SHA-1. A one-step window lets a
// code entered a few seconds late still validate. Implemented directly with
// node:crypto to avoid pulling a heavyweight OTP dependency and to keep the
// secret rotation path obvious.
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function generateTotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

function verifyTotp(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let w = -WINDOW; w <= WINDOW; w++) {
    if (generateTotp(secret, counter + w) === token) return true;
  }
  return false;
}

function buildOtpauthUri(label: string, issuer: string, secret: string): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params.toString()}`;
}

export interface MfaSetupPayload {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export type MfaStatus = 'not-configured' | 'pending' | 'enabled' | 'refused';

export class MfaService {
  private readonly hashService = new HashService();

  /**
   * Generates a TOTP secret and returns both the provisioning URI and a
   * QR-code data URL that the client can render in an <img src=...>.
   * A row is upserted in MfaSetup with `enabled=false` until the user
   * proves they scanned the QR by submitting a valid code via `verify`.
   */
  async startSetup(userId: string, userEmail: string): Promise<MfaSetupPayload> {
    const secret = generateTotpSecret();
    const otpauthUrl = buildOtpauthUri(userEmail, 'BLE$P', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      margin: 1,
      width: 240,
    });

    await transaction(async (tx) => {
      await lockResource(tx, `mfa:${userId}`);
      const current = await tx.mfaSetup.findUnique({ where: { userId } });
      if (current?.enabled) throw new UnauthorizedError('Disable the current factor with a valid code before starting setup.');
      const encrypted = encryptSecret(secret);
      await tx.mfaSetup.upsert({ where: { userId }, update: { secret: encrypted, enabled: false, refusedAt: null, backupCodes: [] }, create: { userId, secret: encrypted, enabled: false } });
    });

    logger.info({ userId }, 'MFA setup initiated');

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * Verifies a 6-digit TOTP code against the stored secret. On success we
   * mark the setup enabled, generate 10 single-use backup codes, store
   * their Argon2 hashes and return the plaintext codes once (the client
   * must display and have the user save them; we never show them again).
   */
  async verify(userId: string, token: string): Promise<{ backupCodes: string[] }> {
    const setup = await prisma.mfaSetup.findUnique({ where: { userId } });
    if (!setup) {
      throw new NotFoundError('MfaSetup', userId);
    }

    if (setup.enabled || setup.refusedAt) throw new ValidationError('Start a new setup before verification.');
    const isValid = verifyTotp(decryptSecret(setup.secret), token);
    if (!isValid) {
      throw new ValidationError('Invalid authentication code.');
    }

    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = generateBackupCode();
      plainCodes.push(code);
      hashedCodes.push(await this.hashService.hash(normaliseBackupCode(code)));
    }

    await transaction(async (tx) => {
      await lockResource(tx, `mfa:${userId}`);
      const result = await tx.mfaSetup.updateMany({ where: { userId, enabled: false, secret: setup.secret }, data: { enabled: true, refusedAt: null, secret: encryptSecret(decryptSecret(setup.secret)), backupCodes: hashedCodes } });
      if (result.count !== 1) throw new ValidationError('Setup changed. Please start again.');
      await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
      await tx.refreshToken.deleteMany({ where: { userId } });
    });

    logger.info({ userId, backupCodeCount: plainCodes.length }, 'MFA enabled with backup codes');
    return { backupCodes: plainCodes };
  }

  /**
   * Consumes a backup code if one matches. Returns true on a successful
   * match and atomically removes the hash from the list so it cannot be
   * reused.
   */
  private async consumeBackupCode(userId: string, plainCode: string): Promise<boolean> {
    const setup = await prisma.mfaSetup.findUnique({ where: { userId } });
    if (!setup || !setup.enabled || setup.backupCodes.length === 0) return false;

    const normalised = normaliseBackupCode(plainCode);
    for (let i = 0; i < setup.backupCodes.length; i++) {
      const ok = await this.hashService.verify(setup.backupCodes[i], normalised);
      if (ok) {
        const remaining = setup.backupCodes.slice(0, i).concat(setup.backupCodes.slice(i + 1));
        const consumed = await prisma.mfaSetup.updateMany({
          where: { userId, enabled: true, backupCodes: { equals: setup.backupCodes } },
          data: { backupCodes: remaining },
        });
        if (consumed.count !== 1) return false;
        logger.info({ userId, remaining: remaining.length }, 'MFA backup code consumed');
        return true;
      }
    }
    return false;
  }

  /**
   * Regenerates the backup-code set. Requires a valid current TOTP code so
   * a stolen session alone cannot rotate them silently.
   */
  async regenerateBackupCodes(userId: string, token: string): Promise<{ backupCodes: string[] }> {
    const setup = await prisma.mfaSetup.findUnique({ where: { userId } });
    if (!setup || !setup.enabled) {
      throw new ValidationError('MFA is not enabled for this account.');
    }
    if (!verifyTotp(decryptSecret(setup.secret), token)) {
      throw new UnauthorizedError('Invalid authentication code.');
    }

    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = generateBackupCode();
      plainCodes.push(code);
      hashedCodes.push(await this.hashService.hash(normaliseBackupCode(code)));
    }

    const changed = await prisma.mfaSetup.updateMany({
      where: { userId, enabled: true, secret: setup.secret, backupCodes: { equals: setup.backupCodes } },
      data: { backupCodes: hashedCodes, secret: encryptSecret(decryptSecret(setup.secret)) },
    });
    if (changed.count !== 1) throw new ValidationError('Factor changed. Please retry.');

    logger.info({ userId }, 'MFA backup codes regenerated');
    return { backupCodes: plainCodes };
  }

  /**
   * Validates a user-supplied second factor for an already-enabled setup.
   * Accepts either a 6-digit TOTP from the authenticator app or one of the
   * single-use backup codes. Backup codes are atomically consumed on a
   * successful match so they cannot be reused.
   */
  async checkCode(userId: string, token: string): Promise<boolean> {
    const setup = await prisma.mfaSetup.findUnique({ where: { userId } });
    if (!setup || !setup.enabled) return false;
    if (/^\d{6}$/.test(token)) {
      return verifyTotp(decryptSecret(setup.secret), token);
    }
    return this.consumeBackupCode(userId, token);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const setup = await prisma.mfaSetup.findUnique({ where: { userId } });
    return Boolean(setup?.enabled);
  }

  async disable(userId: string, token: string): Promise<void> {
    const setup = await prisma.mfaSetup.findUnique({ where: { userId } });
    if (!setup || !setup.enabled) {
      throw new ValidationError('MFA is not enabled for this account.');
    }

    // Accept TOTP or a backup code so a user who lost their authenticator
    // can still turn MFA off from a backup slip.
    const totpOk = /^\d{6}$/.test(token) && verifyTotp(decryptSecret(setup.secret), token);
    const backupOk = !totpOk && (await this.consumeBackupCode(userId, token));
    if (!totpOk && !backupOk) {
      throw new UnauthorizedError('Invalid authentication code.');
    }

    await transaction(async (tx) => {
      await lockResource(tx, `mfa:${userId}`);
      const removed = await tx.mfaSetup.deleteMany({ where: { userId, enabled: true, secret: setup.secret } });
      if (removed.count !== 1) throw new UnauthorizedError('Factor changed. Please retry.');
      await tx.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
      await tx.refreshToken.deleteMany({ where: { userId } });
    });
    logger.info({ userId, via: totpOk ? 'totp' : 'backup' }, 'MFA disabled');
  }

  /**
   * Marks the user as having refused MFA. The opt-in prompt will never
   * show again for this account.
   */
  async refuse(userId: string): Promise<void> {
    await transaction(async (tx) => {
      await lockResource(tx, `mfa:${userId}`);
      const current = await tx.mfaSetup.findUnique({ where: { userId } });
      if (current?.enabled) throw new UnauthorizedError('A current factor is required to disable MFA.');
      await tx.mfaSetup.upsert({ where: { userId }, update: { refusedAt: new Date(), enabled: false, secret: '', backupCodes: [] }, create: { userId, secret: '', enabled: false, refusedAt: new Date() } });
    });
    logger.info({ userId }, 'MFA opt-in refused');
  }

  async getStatus(userId: string): Promise<MfaStatus> {
    const setup = await prisma.mfaSetup.findUnique({ where: { userId } });
    if (!setup) return 'not-configured';
    if (setup.enabled) return 'enabled';
    if (setup.refusedAt) return 'refused';
    return 'pending';
  }
}
