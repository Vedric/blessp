import { Request, Response, NextFunction } from 'express';
import { refreshLifetimeMs } from '../../core/security/token.service';
import { EmailVerificationService } from './email-verification.service';
import { Env } from '../../core/config/env';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { EmailTokenSchema, RegisterSchema, LoginSchema, ForgotPasswordSchema, ResetPasswordSchema, GoogleOAuthSchema, AppleOAuthSchema } from './auth.schema';
import { sendSuccess, sendNoContent } from '../../core/types/response';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

const REFRESH_TOKEN_COOKIE = 'refreshToken';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: Env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: refreshLifetimeMs(),
};

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = RegisterSchema.parse(req.body);
      await this.authService.register(dto);
      res.status(202).json({ data: { message: 'Check your inbox to verify your email address. If you already have an account, sign in or reset your password.' } });
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
      const { email, locale } = ForgotPasswordSchema.parse(req.body);
      await this.authService.forgotPassword(email, locale);

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

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = EmailTokenSchema.parse(req.body);
      await new EmailVerificationService().confirm(token);
      sendSuccess(res, req, { message: 'Email verified. You can now sign in.' });
    } catch (error) { next(error); }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, locale } = ForgotPasswordSchema.parse(req.body);
      await new EmailVerificationService().resend(email, locale);
      sendSuccess(res, req, { message: 'If verification is needed, an email will be sent.' });
    } catch (error) { next(error); }
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
      const { idToken, mfaToken, firstName, lastName, locale } = GoogleOAuthSchema.parse(req.body);
      const oauthUser = await this.oauthService.verifyGoogleToken(idToken);

      const result = await this.authService.oauthLogin({
        provider: 'google', mfaToken, locale,
        providerAccountId: oauthUser.providerAccountId,
        email: oauthUser.email,
        firstName: oauthUser.firstName || firstName,
        lastName: oauthUser.lastName || lastName,
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
      const { idToken, firstName, lastName, mfaToken, locale } = AppleOAuthSchema.parse(req.body);
      const oauthUser = await this.oauthService.verifyAppleToken(idToken);

      const result = await this.authService.oauthLogin({
        provider: 'apple', mfaToken, locale,
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
