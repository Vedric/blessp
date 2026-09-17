import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { OAuthService } from './oauth.service';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';
import { HashService } from '../../core/security/hash.service';
import { TokenService } from '../../core/security/token.service';
import { authenticate } from '../../core/middleware/authenticate';
import { authRateLimiter } from '../../core/middleware/rate.limit';

const authRepository = new AuthRepository();
const hashService = new HashService();
const tokenService = new TokenService();
const oauthService = new OAuthService();
const mfaService = new MfaService();
const authService = new AuthService(authRepository, hashService, tokenService, mfaService);
const authController = new AuthController(authService, oauthService);
const mfaController = new MfaController(mfaService);

const router = Router();

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/refresh', authRateLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);
router.post('/verify-email', authRateLimiter, authController.verifyEmail);
router.post('/resend-verification', authRateLimiter, authController.resendVerification);
router.get('/me', authenticate, authController.me);

// OAuth endpoints
router.post('/google', authRateLimiter, authController.googleLogin);
router.post('/apple', authRateLimiter, authController.appleLogin);

// MFA (TOTP) endpoints - all require an authenticated session
router.get('/mfa/status', authenticate, authRateLimiter, mfaController.status);
router.post('/mfa/setup', authenticate, authRateLimiter, mfaController.start);
router.post('/mfa/verify', authenticate, authRateLimiter, mfaController.verify);
router.post('/mfa/disable', authenticate, authRateLimiter, mfaController.disable);
router.post('/mfa/backup-codes', authenticate, authRateLimiter, mfaController.regenerateBackupCodes);
router.post('/mfa/refuse', authenticate, authRateLimiter, mfaController.refuse);

export { router as authRouter };
