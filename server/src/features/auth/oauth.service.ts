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

// Response from Google's tokeninfo endpoint. Unlike /userinfo, this endpoint
// returns the audience (aud), letting us verify the access token was issued
// for our OAuth client and is not a token stolen from another application.
interface GoogleTokenInfoResponse {
  aud: string;
  sub: string;
  scope?: string;
  exp: string;
  email?: string;
  email_verified?: string | boolean;
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
   * Verifies a Google OAuth access token by calling Google's tokeninfo endpoint.
   * Crucially, tokeninfo returns the audience (aud) so we can reject tokens
   * issued for a different OAuth client. This prevents an attacker from
   * presenting a valid Google access token obtained for another application
   * and having it accepted here.
   */
  async verifyGoogleToken(accessToken: string): Promise<OAuthUserInfo> {
    if (!Env.GOOGLE_CLIENT_ID) {
      throw new UnauthorizedError('Google sign-in is not configured.');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { signal: AbortSignal.timeout(5000) },
      );

      if (!response.ok) {
        throw new UnauthorizedError('Invalid or expired Google token.');
      }

      const payload = (await response.json()) as GoogleTokenInfoResponse;

      if (payload.aud !== Env.GOOGLE_CLIENT_ID) {
        logger.warn(
          { expectedAud: Env.GOOGLE_CLIENT_ID, receivedAud: payload.aud },
          'Google token audience mismatch',
        );
        throw new UnauthorizedError('Google token was issued for a different client.');
      }

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedError('Invalid Google token: missing email.');
      }
      if (!/^\d+$/.test(payload.exp) || !Number.isSafeInteger(Number(payload.exp)) || Number(payload.exp) * 1000 <= Date.now()) {
        throw new UnauthorizedError('Invalid or expired Google token.');
      }

      const emailVerified =
        payload.email_verified === true || payload.email_verified === 'true';
      if (!emailVerified) {
        throw new UnauthorizedError('Google account email is not verified.');
      }

      // tokeninfo establishes audience/expiry but does not promise profile names.
      if (!payload.given_name || !payload.family_name) {
        const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000), redirect: 'error',
        });
        if (!profileResponse.ok) throw new UnauthorizedError('Google profile is unavailable.');
        const profile = await profileResponse.json() as { sub?: string; email?: string; given_name?: string; family_name?: string };
        if (profile.sub !== payload.sub || profile.email?.toLowerCase() !== payload.email.toLowerCase()) throw new UnauthorizedError('Google profile does not match the verified identity.');
        payload.given_name = profile.given_name; payload.family_name = profile.family_name;
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
    if (!Env.APPLE_CLIENT_ID) throw new UnauthorizedError('Apple sign-in is not configured.');
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

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedError('Invalid Apple token: missing email.');
      }

      // Apple's JWT returns email_verified as the string "true"/"false" for
      // real emails, and as a boolean for private-relay addresses. Match both.
      const emailVerified =
        payload.email_verified === true || payload.email_verified === 'true';
      if (!emailVerified) {
        throw new UnauthorizedError('Apple account email is not verified.');
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
