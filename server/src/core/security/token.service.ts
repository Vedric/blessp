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

export class TokenService {
  signAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = {
      algorithm: 'HS256',
      expiresIn: Env.JWT_ACCESS_EXPIRY as unknown as number,
    };
    return jwt.sign({ ...payload }, Env.JWT_ACCESS_SECRET, options);
  }

  signRefreshToken(payload: RefreshTokenPayload): string {
    const options: SignOptions = {
      algorithm: 'HS256',
      expiresIn: Env.JWT_REFRESH_EXPIRY as unknown as number,
    };
    return jwt.sign({ ...payload }, Env.JWT_REFRESH_SECRET, options);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, Env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
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
      const decoded = jwt.verify(token, Env.JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
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
