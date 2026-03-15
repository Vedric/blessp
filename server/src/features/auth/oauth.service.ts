import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Env } from '../../core/config/env';
import { UnauthorizedError } from '../../core/errors/http.errors';
import { logger } from '../../core/observability/logger';

interface OAuthUserInfo {
  providerAccountId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface GoogleUserInfoResponse {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
}

const appleJwksClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getAppleSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!header.kid) {
      return reject(new Error('Missing kid in JWT header'));
    }
    appleJwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

export class OAuthService {
  /**
   * Verifies a Google OAuth access token by calling Google's userinfo endpoint.
   * The frontend obtains this token via the implicit OAuth flow.
   */
  async verifyGoogleToken(accessToken: string): Promise<OAuthUserInfo> {
    if (!Env.GOOGLE_CLIENT_ID) {
      throw new UnauthorizedError('Google sign-in is not configured.');
    }

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new UnauthorizedError('Invalid or expired Google token.');
      }

      const payload = (await response.json()) as GoogleUserInfoResponse;

      if (!payload.email) {
        throw new UnauthorizedError('Invalid Google token: missing email.');
      }

      if (!payload.email_verified) {
        throw new UnauthorizedError('Google account email is not verified.');
      }

      return {
        providerAccountId: payload.sub,
        email: payload.email.toLowerCase(),
        firstName: payload.given_name,
        lastName: payload.family_name,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      logger.warn({ err: error }, 'Google token verification failed');
      throw new UnauthorizedError('Invalid or expired Google token.');
    }
  }

  /**
   * Verifies an Apple Sign In ID token by validating the JWT signature
   * against Apple's published JWKS keys.
   */
  async verifyAppleToken(idToken: string): Promise<OAuthUserInfo> {
    try {
      const decoded = jwt.decode(idToken, { complete: true });
      if (!decoded || !decoded.header) {
        throw new UnauthorizedError('Invalid Apple token format.');
      }

      const signingKey = await getAppleSigningKey(decoded.header);

      const payload = jwt.verify(idToken, signingKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: Env.APPLE_CLIENT_ID,
      }) as jwt.JwtPayload;

      if (!payload.email) {
        throw new UnauthorizedError('Invalid Apple token: missing email.');
      }

      return {
        providerAccountId: payload.sub!,
        email: (payload.email as string).toLowerCase(),
        firstName: undefined,
        lastName: undefined,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      logger.warn({ err: error }, 'Apple token verification failed');
      throw new UnauthorizedError('Invalid or expired Apple token.');
    }
  }
}
