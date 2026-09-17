import { decryptSecret, encryptSecret } from '../../src/core/security/secrets';

describe('MFA secret authenticated encryption', () => {
  it('uses independent nonces and decrypts the original factor', () => {
    const first = encryptSecret('synthetic-factor');
    expect(encryptSecret('synthetic-factor')).not.toBe(first);
    expect(decryptSecret(first)).toBe('synthetic-factor');
  });

  it.each([0, 4, 8, 12, 15])('rejects a shortened authentication tag (%i bytes)', (length) => {
    const parts = encryptSecret('synthetic-factor').split(':');
    parts[2] = Buffer.from(parts[2], 'base64').subarray(0, length).toString('base64');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('rejects changed ciphertext', () => {
    const parts = encryptSecret('synthetic-factor').split(':');
    const data = Buffer.from(parts[3], 'base64');
    data[0] ^= 1;
    parts[3] = data.toString('base64');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('rejects malformed envelopes and nonce lengths', () => {
    expect(() => decryptSecret('v1:missing')).toThrow();
    const parts = encryptSecret('synthetic-factor').split(':');
    parts[1] = Buffer.alloc(8).toString('base64');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('retains the documented legacy read path until maintenance encrypts the row', () => {
    expect(decryptSecret('LEGACYBASE32')).toBe('LEGACYBASE32');
  });
});
