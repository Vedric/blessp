import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { HashService } from '../../core/security/hash.service';
import { TokenService } from '../../core/security/token.service';
import { authenticate } from '../../core/middleware/authenticate';
import { authRateLimiter } from '../../core/middleware/rate.limit';

const authRepository = new AuthRepository();
const hashService = new HashService();
const tokenService = new TokenService();
const authService = new AuthService(authRepository, hashService, tokenService);
const authController = new AuthController(authService);

const router = Router();

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/refresh', authRateLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);
router.get('/me', authenticate, authController.me);

export { router as authRouter };
