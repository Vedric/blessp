// Mock the prisma client used directly in MfaService.
// jest.mock is hoisted, so we build the mock object inside the factory.
jest.mock('@core/database/client', () => {
  const mockMfaSetup = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    update: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn(),
  };
  const client: any = { mfaSetup: mockMfaSetup, user: { update: jest.fn() }, refreshToken: { deleteMany: jest.fn() }, $queryRaw: jest.fn() };
  client.$transaction = jest.fn((callback: any) => callback(client));
  return {
    prisma: client,
    getPrismaClient: jest.fn(),
  };
});

jest.mock('@core/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Argon2 is deterministic here so backup-code hashing stays fast and the
// stored digests are assertable without running the real KDF.
jest.mock('argon2', () => ({
  __esModule: true,
  default: {
    argon2id: 2,
    hash: jest.fn(async (plain: string) => `hashed:${plain}`),
    verify: jest.fn(async (digest: string, plain: string) => digest === `hashed:${plain}`),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,qr-fixture'),
}));

import crypto from 'crypto';
import { MfaService } from '@features/auth/mfa.service';
import { NotFoundError, UnauthorizedError, ValidationError } from '@core/errors/http.errors';
import { prisma } from '@core/database/client';

const mockMfaSetup = prisma.mfaSetup as unknown as {
  findUnique: jest.Mock;
  upsert: jest.Mock;
  updateMany: jest.Mock;
  update: jest.Mock;
  deleteMany: jest.Mock;
  delete: jest.Mock;
};

// RFC 4226 appendix D test secret ("12345678901234567890" in base32). The
// reference generator below is an independent RFC 6238 implementation, so a
// regression in the service cannot be masked by sharing its code path. It is
// anchored to the published vectors in its own test.
// Derive the test fixture from the RFC's public ASCII input, not a stored credential.
const rfcBits = [...Buffer.from('12345678901234567890', 'ascii')].map(byte => byte.toString(2).padStart(8, '0')).join('');
const RFC_SECRET = rfcBits.match(/.{5}/g)!.map(bits => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[parseInt(bits, 2)]).join('');

function base32ToBuffer(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.replace(/=+$/, '').toUpperCase()) {
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

function totpAt(secret: string, unixSeconds: number, stepOffset = 0): string {
  const counter = Math.floor(unixSeconds / 30) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32ToBuffer(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** 6).padStart(6, '0');
}

// The service accepts a one-step window, so at FIXED_NOW the valid codes are
// those for counters 0, 1 and 2. Counter 3 is deterministically rejected.
const FIXED_NOW_SECONDS = 59; // counter 1

describe('totpAt reference generator', () => {
  it('matches the RFC 6238 published vector at T=59s', () => {
    expect(totpAt(RFC_SECRET, 59)).toBe('287082');
  });
});

describe('MfaService', () => {
  let service: MfaService;
  const userId = 'usr_mfa-user';

  function makeMfaSetup(overrides: Record<string, unknown> = {}) {
    return {
      userId,
      secret: RFC_SECRET,
      enabled: true,
      refusedAt: null,
      backupCodes: [],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockMfaSetup.findUnique.mockReset();
    mockMfaSetup.updateMany.mockResolvedValue({ count: 1 });
    mockMfaSetup.deleteMany.mockResolvedValue({ count: 1 });
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_SECONDS * 1000);
    service = new MfaService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startSetup', () => {
    it('upserts a disabled setup row with a fresh base32 secret', async () => {
      mockMfaSetup.upsert.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      const result = await service.startSetup(userId, 'alice@example.com');

      // 20 random bytes encode to 32 base32 characters
      expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(mockMfaSetup.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: { secret: expect.stringMatching(/^v1:/), enabled: false, refusedAt: null, backupCodes: [] },
        create: { userId, secret: expect.stringMatching(/^v1:/), enabled: false },
      });
    });

    it('returns a provisioning URI carrying the issuer and secret plus a QR data URL', async () => {
      mockMfaSetup.upsert.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      const result = await service.startSetup(userId, 'alice@example.com');

      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain(encodeURIComponent('BLE$P'));
      expect(result.otpauthUrl).toContain(`secret=${result.secret}`);
      expect(result.otpauthUrl).toContain('alice%40example.com');
      expect(result.qrCodeDataUrl).toBe('data:image/png;base64,qr-fixture');
    });
  });

  describe('verify', () => {
    it('throws NotFoundError when no setup exists for the user', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(null);

      await expect(service.verify(userId, '287082')).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when the token is not a 6-digit code', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      await expect(service.verify(userId, 'abcdef')).rejects.toThrow(ValidationError);
      expect(mockMfaSetup.update).not.toHaveBeenCalled();
    });

    it('throws ValidationError when the code is outside the accepted window', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      // Counter 3 is two steps ahead of the current counter, outside the window
      const outsideWindow = totpAt(RFC_SECRET, FIXED_NOW_SECONDS, 2);
      await expect(service.verify(userId, outsideWindow)).rejects.toThrow(ValidationError);
      expect(mockMfaSetup.update).not.toHaveBeenCalled();
    });

    it('enables the setup and returns ten single-use backup codes on a valid code', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));
      mockMfaSetup.update.mockResolvedValueOnce(makeMfaSetup());

      const result = await service.verify(userId, totpAt(RFC_SECRET, FIXED_NOW_SECONDS));

      expect(result.backupCodes).toHaveLength(10);
      for (const code of result.backupCodes) {
        expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      }
      expect(mockMfaSetup.updateMany).toHaveBeenCalledWith({
        where: { userId, enabled: false, secret: RFC_SECRET },
        data: {
          secret: expect.stringMatching(/^v1:/),
          enabled: true,
          refusedAt: null,
          backupCodes: result.backupCodes.map((code) => `hashed:${code}`),
        },
      });
    });

    it('round-trips a code minted for a secret produced by the service itself', async () => {
      mockMfaSetup.upsert.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));
      const { secret } = await service.startSetup(userId, 'alice@example.com');

      mockMfaSetup.findUnique.mockResolvedValueOnce(
        makeMfaSetup({ secret, enabled: false }),
      );
      mockMfaSetup.update.mockResolvedValueOnce(makeMfaSetup({ secret }));

      const result = await service.verify(userId, totpAt(secret, FIXED_NOW_SECONDS));

      expect(result.backupCodes).toHaveLength(10);
    });
  });

  describe('checkCode', () => {
    it('returns false when the user has no setup', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(null);

      await expect(service.checkCode(userId, '287082')).resolves.toBe(false);
    });

    it('returns false when the setup is not enabled yet', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      await expect(service.checkCode(userId, '287082')).resolves.toBe(false);
    });

    it('accepts the code for the current time step', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup());

      await expect(
        service.checkCode(userId, totpAt(RFC_SECRET, FIXED_NOW_SECONDS)),
      ).resolves.toBe(true);
    });

    it('tolerates a code from one step behind or ahead', async () => {
      mockMfaSetup.findUnique.mockResolvedValue(makeMfaSetup());

      await expect(
        service.checkCode(userId, totpAt(RFC_SECRET, FIXED_NOW_SECONDS, -1)),
      ).resolves.toBe(true);
      await expect(
        service.checkCode(userId, totpAt(RFC_SECRET, FIXED_NOW_SECONDS, 1)),
      ).resolves.toBe(true);
    });

    it('rejects a code from two steps away', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup());

      await expect(
        service.checkCode(userId, totpAt(RFC_SECRET, FIXED_NOW_SECONDS, 2)),
      ).resolves.toBe(false);
    });

    it('consumes a matching backup code and removes it from the stored list', async () => {
      const setup = makeMfaSetup({
        backupCodes: ['hashed:AAAAA-22222', 'hashed:BBBBB-33333'],
      });
      // consumeBackupCode re-reads the setup after the TOTP shape check fails
      mockMfaSetup.findUnique.mockResolvedValue(setup);
      mockMfaSetup.update.mockResolvedValueOnce(setup);

      // Lowercase input with stray whitespace must still match after normalisation
      await expect(service.checkCode(userId, ' bbbbb-33333 ')).resolves.toBe(true);

      expect(mockMfaSetup.updateMany).toHaveBeenCalledWith({
        where: { userId, enabled: true, backupCodes: { equals: setup.backupCodes } },
        data: { backupCodes: ['hashed:AAAAA-22222'] },
      });
    });

    it('rejects a backup code that has already been consumed', async () => {
      // The list no longer contains the code, mirroring a prior consumption
      mockMfaSetup.findUnique.mockResolvedValue(
        makeMfaSetup({ backupCodes: ['hashed:AAAAA-22222'] }),
      );

      await expect(service.checkCode(userId, 'BBBBB-33333')).resolves.toBe(false);
      expect(mockMfaSetup.update).not.toHaveBeenCalled();
    });

    it('rejects a backup code when none are stored', async () => {
      mockMfaSetup.findUnique.mockResolvedValue(makeMfaSetup({ backupCodes: [] }));

      await expect(service.checkCode(userId, 'AAAAA-22222')).resolves.toBe(false);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('throws ValidationError when MFA is not enabled', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      await expect(
        service.regenerateBackupCodes(userId, '287082'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws UnauthorizedError when the TOTP code is invalid', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup());

      const outsideWindow = totpAt(RFC_SECRET, FIXED_NOW_SECONDS, 2);
      await expect(
        service.regenerateBackupCodes(userId, outsideWindow),
      ).rejects.toThrow(UnauthorizedError);
      expect(mockMfaSetup.update).not.toHaveBeenCalled();
    });

    it('replaces the stored hashes with ten fresh codes on a valid TOTP', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(
        makeMfaSetup({ backupCodes: ['hashed:OLDDD-11111'] }),
      );
      mockMfaSetup.update.mockResolvedValueOnce(makeMfaSetup());

      const result = await service.regenerateBackupCodes(
        userId,
        totpAt(RFC_SECRET, FIXED_NOW_SECONDS),
      );

      expect(result.backupCodes).toHaveLength(10);
      expect(mockMfaSetup.updateMany).toHaveBeenCalledWith({
        where: { userId, enabled: true, secret: RFC_SECRET, backupCodes: { equals: ['hashed:OLDDD-11111'] } },
        data: {
          secret: expect.stringMatching(/^v1:/),
          backupCodes: result.backupCodes.map((code) => `hashed:${code}`),
        },
      });
    });
  });

  describe('disable', () => {
    it('throws ValidationError when MFA is not enabled', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      await expect(service.disable(userId, '287082')).rejects.toThrow(ValidationError);
      expect(mockMfaSetup.delete).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when neither a TOTP nor a backup code matches', async () => {
      mockMfaSetup.findUnique.mockResolvedValue(
        makeMfaSetup({ backupCodes: ['hashed:AAAAA-22222'] }),
      );

      await expect(service.disable(userId, 'WRONG-CODE1')).rejects.toThrow(UnauthorizedError);
      expect(mockMfaSetup.delete).not.toHaveBeenCalled();
    });

    it('deletes the setup on a valid TOTP code', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup());
      mockMfaSetup.delete.mockResolvedValueOnce(makeMfaSetup());

      await service.disable(userId, totpAt(RFC_SECRET, FIXED_NOW_SECONDS));

      expect(mockMfaSetup.deleteMany).toHaveBeenCalledWith({ where: { userId, enabled: true, secret: RFC_SECRET } });
    });

    it('deletes the setup on a valid backup code when the authenticator is lost', async () => {
      const setup = makeMfaSetup({ backupCodes: ['hashed:AAAAA-22222'] });
      mockMfaSetup.findUnique.mockResolvedValue(setup);
      mockMfaSetup.update.mockResolvedValueOnce(setup);
      mockMfaSetup.delete.mockResolvedValueOnce(setup);

      await service.disable(userId, 'AAAAA-22222');

      expect(mockMfaSetup.deleteMany).toHaveBeenCalledWith({ where: { userId, enabled: true, secret: RFC_SECRET } });
    });
  });

  describe('refuse', () => {
    it('records the refusal and clears the secret', async () => {
      mockMfaSetup.upsert.mockResolvedValueOnce(
        makeMfaSetup({ enabled: false, refusedAt: new Date() }),
      );

      await service.refuse(userId);

      expect(mockMfaSetup.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: { refusedAt: expect.any(Date), enabled: false, secret: '', backupCodes: [] },
        create: { userId, secret: '', enabled: false, refusedAt: expect.any(Date) },
      });
    });
  });

  describe('isEnabled', () => {
    it('returns true for an enabled setup', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup());

      await expect(service.isEnabled(userId)).resolves.toBe(true);
    });

    it('returns false when no setup exists', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(null);

      await expect(service.isEnabled(userId)).resolves.toBe(false);
    });

    it('returns false for a pending (not yet verified) setup', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      await expect(service.isEnabled(userId)).resolves.toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns not-configured when no row exists', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(null);

      await expect(service.getStatus(userId)).resolves.toBe('not-configured');
    });

    it('returns enabled for an active setup', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup());

      await expect(service.getStatus(userId)).resolves.toBe('enabled');
    });

    it('returns refused when the user opted out', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(
        makeMfaSetup({ enabled: false, refusedAt: new Date('2026-02-01T00:00:00Z') }),
      );

      await expect(service.getStatus(userId)).resolves.toBe('refused');
    });

    it('returns pending when setup started but was never verified', async () => {
      mockMfaSetup.findUnique.mockResolvedValueOnce(makeMfaSetup({ enabled: false }));

      await expect(service.getStatus(userId)).resolves.toBe('pending');
    });
  });
});
