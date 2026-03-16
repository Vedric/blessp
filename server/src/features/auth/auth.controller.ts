import { Request, Response, NextFunction } from 'express';
import { Env } from '../../core/config/env';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, GoogleOAuthSchema, AppleOAuthSchema } from './auth.schema';
import { sendSuccess, sendCreated, sendNoContent } from '../../core/types/response';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

const REFRESH_TOKEN_COOKIE = 'refreshToken';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: Env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = RegisterSchema.parse(req.body);
      const result = await this.authService.register(dto);

      res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      sendCreated(res, req, {
        user: result.user,
        tokens: { accessToken: result.tokens.accessToken },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = LoginSchema.parse(req.body);
      const result = await this.authService.login(dto);

      res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      sendSuccess(res, req, {
        user: result.user,
        tokens: { accessToken: result.tokens.accessToken },
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      if (!refreshToken) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Refresh token is missing.',
            requestId: req.headers['x-request-id'] as string,
          },
        });
        return;
      }

      const tokens = await this.authService.refreshToken(refreshToken);

      res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      sendSuccess(res, req, { tokens: { accessToken: tokens.accessToken } });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      if (refreshToken) {
        await this.authService.logout(refreshToken);
      }

      res.clearCookie(REFRESH_TOKEN_COOKIE, {
        httpOnly: true,
        secure: Env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        path: '/api/v1/auth',
      });

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = ForgotPasswordSchema.parse(req.body);
      await this.authService.forgotPassword(email);

      sendSuccess(res, req, { message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, password } = ResetPasswordSchema.parse(req.body);
      await this.authService.resetPassword(token, password);

      sendSuccess(res, req, { message: 'Password has been reset successfully.' });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.userId;
      const user = await this.authService.getMe(userId);

      sendSuccess(res, req, user);
    } catch (error) {
      next(error);
    }
  };

  googleLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idToken } = GoogleOAuthSchema.parse(req.body);
      const oauthUser = await this.oauthService.verifyGoogleToken(idToken);

      const result = await this.authService.oauthLogin({
        provider: 'google',
        providerAccountId: oauthUser.providerAccountId,
        email: oauthUser.email,
        firstName: oauthUser.firstName,
        lastName: oauthUser.lastName,
      });

      res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      sendSuccess(res, req, {
        user: result.user,
        tokens: { accessToken: result.tokens.accessToken },
      });
    } catch (error) {
      next(error);
    }
  };

  appleLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idToken, firstName, lastName } = AppleOAuthSchema.parse(req.body);
      const oauthUser = await this.oauthService.verifyAppleToken(idToken);

      const result = await this.authService.oauthLogin({
        provider: 'apple',
        providerAccountId: oauthUser.providerAccountId,
        email: oauthUser.email,
        firstName: firstName ?? oauthUser.firstName,
        lastName: lastName ?? oauthUser.lastName,
      });

      res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      sendSuccess(res, req, {
        user: result.user,
        tokens: { accessToken: result.tokens.accessToken },
      });
    } catch (error) {
      next(error);
    }
  };
}
