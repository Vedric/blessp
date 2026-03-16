import { UnauthorizedError } from '@core/errors/http.errors';

// Mock the env module so GOOGLE_CLIENT_ID and APPLE_CLIENT_ID are controllable
jest.mock('@core/config/env', () => ({
  Env: {
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    APPLE_CLIENT_ID: 'test-apple-client-id',
  },
}));

jest.mock('@core/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    decode: jest.fn(),
    verify: jest.fn(),
  },
}));

// Mock jwks-rsa: the module-level call to jwksClient() must return a mock client
const mockGetSigningKey = jest.fn();
jest.mock('jwks-rsa', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getSigningKey: mockGetSigningKey,
  })),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import jwt from 'jsonwebtoken';
import { OAuthService } from '@features/auth/oauth.service';
import { Env } from '@core/config/env';

const mockJwt = jwt as unknown as {
  decode: jest.Mock;
  verify: jest.Mock;
};

describe('OAuthService', () => {
  let service: OAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OAuthService();
  });

  describe('verifyGoogleToken', () => {
    it('returns user info on a valid Google access token', async () => {
      const googlePayload = {
        sub: 'google-uid-123',
        email: 'Alice@Example.com',
        email_verified: true,
        given_name: 'Alice',
        family_name: 'Dupont',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => googlePayload,
      });

      const result = await service.verifyGoogleToken('valid-access-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: 'Bearer valid-access-token' } },
      );
      expect(result).toEqual({
        providerAccountId: 'google-uid-123',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Dupont',
      });
    });

    it('throws UnauthorizedError when the Google API returns a non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(service.verifyGoogleToken('expired-token')).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('throws UnauthorizedError when the Google account email is not verified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-uid-456',
          email: 'unverified@example.com',
          email_verified: false,
        }),
      });

      const error = await service.verifyGoogleToken('some-token').catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toMatch(/not verified/);
    });

    it('throws UnauthorizedError when GOOGLE_CLIENT_ID is not configured', async () => {
      const original = Env.GOOGLE_CLIENT_ID;
      (Env as any).GOOGLE_CLIENT_ID = undefined;

      const error = await service.verifyGoogleToken('any-token').catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toMatch(/not configured/);

      (Env as any).GOOGLE_CLIENT_ID = original;
    });
  });

  describe('verifyAppleToken', () => {
    it('returns user info on a valid Apple ID token', async () => {
      const decodedHeader = {
        header: { kid: 'apple-key-id', alg: 'RS256' },
        payload: {},
        signature: '',
      };

      mockJwt.decode.mockReturnValueOnce(decodedHeader);

      mockGetSigningKey.mockImplementationOnce(
        (_kid: string, cb: (err: Error | null, key?: any) => void) => {
          cb(null, { getPublicKey: () => 'apple-public-key-pem' });
        },
      );

      mockJwt.verify.mockReturnValueOnce({
        sub: 'apple-uid-789',
        email: 'Bob@Example.com',
        iss: 'https://appleid.apple.com',
        aud: 'test-apple-client-id',
      });

      const result = await service.verifyAppleToken('valid.apple.id-token');

      expect(mockJwt.decode).toHaveBeenCalledWith('valid.apple.id-token', { complete: true });
      expect(mockJwt.verify).toHaveBeenCalledWith(
        'valid.apple.id-token',
        'apple-public-key-pem',
        {
          algorithms: ['RS256'],
          issuer: 'https://appleid.apple.com',
          audience: 'test-apple-client-id',
        },
      );
      expect(result).toEqual({
        providerAccountId: 'apple-uid-789',
        email: 'bob@example.com',
        firstName: undefined,
        lastName: undefined,
      });
    });

    it('throws UnauthorizedError when the token cannot be decoded', async () => {
      mockJwt.decode.mockReturnValueOnce(null);

      await expect(service.verifyAppleToken('garbage')).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('throws UnauthorizedError when the JWT signature is invalid', async () => {
      mockJwt.decode.mockReturnValueOnce({
        header: { kid: 'apple-key-id', alg: 'RS256' },
        payload: {},
        signature: '',
      });

      mockGetSigningKey.mockImplementationOnce(
        (_kid: string, cb: (err: Error | null, key?: any) => void) => {
          cb(null, { getPublicKey: () => 'apple-public-key-pem' });
        },
      );

      mockJwt.verify.mockImplementationOnce(() => {
        throw new Error('invalid signature');
      });

      await expect(service.verifyAppleToken('bad-sig-token')).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });
});
