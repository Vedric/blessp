import crypto from 'crypto';
import { z } from 'zod';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Env } from '../config/env';
import { UnauthorizedError } from '../errors/http.errors';
import { TokenExpiredError } from '../errors/domain.errors';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  sessionVersion?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  familyId: string;
}

const accessClaims = z.object({ userId: z.string().uuid(), email: z.string().email(), isAdmin: z.boolean(), sessionVersion: z.number().int().nonnegative(), tokenUse: z.literal('access'), exp: z.number(), iat: z.number() });
const refreshClaims = z.object({ userId: z.string().uuid(), familyId: z.string().uuid(), tokenUse: z.literal('refresh'), exp: z.number(), iat: z.number(), jti: z.string().uuid() });

export function refreshLifetimeMs(): number {
  const value = Env.JWT_REFRESH_EXPIRY;
  const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(value.slice(0, -1)) * units[value.slice(-1)];
}

function decodeKey(base64: string): string {
  return Buffer.from(base64, 'base64').toString('utf8');
}

let _privateKey: string | null = null;
let _publicKey: string | null = null;

function getPrivateKey(): string {
  if (!_privateKey) {
    _privateKey = decodeKey(Env.JWT_PRIVATE_KEY_BASE64);
  }
  return _privateKey;
}

function getPublicKey(): string {
  if (!_publicKey) {
    _publicKey = decodeKey(Env.JWT_PUBLIC_KEY_BASE64);
  }
  return _publicKey;
}

export class TokenService {
  signAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: Env.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
      issuer: 'blessp', audience: 'blessp-api',
    };
    return jwt.sign({ ...payload, sessionVersion: payload.sessionVersion ?? 0, tokenUse: 'access' }, getPrivateKey(), options);
  }

  signRefreshToken(payload: RefreshTokenPayload): string {
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: Env.JWT_REFRESH_EXPIRY as SignOptions['expiresIn'],
      issuer: 'blessp', audience: 'blessp-refresh',
      jwtid: crypto.randomUUID(),
    };
    return jwt.sign({ ...payload, tokenUse: 'refresh' }, getPrivateKey(), options);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = accessClaims.parse(jwt.verify(token, getPublicKey(), {
        algorithms: ['RS256'], issuer: 'blessp', audience: 'blessp-api',
      }));

      return {
        userId: decoded.userId,
        email: decoded.email,
        isAdmin: decoded.isAdmin,
        sessionVersion: decoded.sessionVersion,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('Access token has expired.');
      }
      throw new UnauthorizedError('Invalid access token.');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = refreshClaims.parse(jwt.verify(token, getPublicKey(), {
        algorithms: ['RS256'], issuer: 'blessp', audience: 'blessp-refresh',
      }));

      return {
        userId: decoded.userId,
        familyId: decoded.familyId,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('Refresh token has expired.');
      }
      throw new UnauthorizedError('Invalid refresh token.');
    }
  }
}
