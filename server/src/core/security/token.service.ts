import jwt, { type SignOptions } from 'jsonwebtoken';
import { Env } from '../config/env';
import { UnauthorizedError } from '../errors/http.errors';
import { TokenExpiredError } from '../errors/domain.errors';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export interface RefreshTokenPayload {
  userId: string;
  familyId: string;
}

interface JwtAccessClaims extends AccessTokenPayload {
  iat: number;
  exp: number;
}

interface JwtRefreshClaims extends RefreshTokenPayload {
  iat: number;
  exp: number;
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
      expiresIn: Env.JWT_ACCESS_EXPIRY as unknown as number,
    };
    return jwt.sign({ ...payload }, getPrivateKey(), options);
  }

  signRefreshToken(payload: RefreshTokenPayload): string {
    const options: SignOptions = {
      algorithm: 'RS256',
      expiresIn: Env.JWT_REFRESH_EXPIRY as unknown as number,
    };
    return jwt.sign({ ...payload }, getPrivateKey(), options);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, getPublicKey(), {
        algorithms: ['RS256'],
      }) as JwtAccessClaims;

      return {
        userId: decoded.userId,
        email: decoded.email,
        isAdmin: decoded.isAdmin,
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
      const decoded = jwt.verify(token, getPublicKey(), {
        algorithms: ['RS256'],
      }) as JwtRefreshClaims;

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
