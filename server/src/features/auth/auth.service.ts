import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { hashToken } from '../../core/security/secrets';
import { EmailVerificationService } from './email-verification.service';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../core/database/client';
import { InvalidCredentialsError } from '../../core/errors/domain.errors';
import { AppError } from '../../core/errors/app.error';
import { UnauthorizedError, ProfileRequiredError } from '../../core/errors/http.errors';

export class MfaRequiredError extends AppError {
  readonly statusCode = 401;
  readonly code = 'MFA_REQUIRED';
  constructor() {
    super('A multi-factor authentication code is required to sign in.');
  }
}

export class InvalidMfaCodeError extends AppError {
  readonly statusCode = 401;
  readonly code = 'INVALID_MFA_CODE';
  constructor() {
    super('Invalid multi-factor authentication code.');
  }
}
import { AuthRepository } from './auth.repository';
import { RegisterDto, LoginDto, TokenPair, AuthUserResponse, OAuthLoginDto } from './auth.types';
import { HashService } from '../../core/security/hash.service';
import { TokenService, refreshLifetimeMs } from '../../core/security/token.service';
import { logger } from '../../core/observability/logger';
import { passwordResetEmailPayload, welcomeEmailPayload, type AccountLocale } from './auth.emails';
import { enqueueEmail } from '../../core/email/outbox';
import { MfaService } from './mfa.service';

export type RegisterResult = { created: boolean };

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly hashService: HashService,
    private readonly tokenService: TokenService,
    private readonly mfaService?: MfaService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      if (!existing.deletedAt && !existing.emailVerifiedAt) {
        await new EmailVerificationService().request(existing.id, existing.email, dto.locale);
      }
      return { created: false };
    }
    const passwordHash = await this.hashService.hash(dto.password);
    try {
      const user = await prisma.user.create({ data: { email: dto.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName } });
      await new EmailVerificationService().request(user.id, user.email, dto.locale);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    }
    return { created: true };
  }

  async login(dto: LoginDto): Promise<{ user: AuthUserResponse; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      throw new InvalidCredentialsError();
    }

    // OAuth-only users cannot sign in with email/password
    if (!user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const isValid = await this.hashService.verify(user.passwordHash, dto.password);

    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    if (!user.emailVerifiedAt) throw new UnauthorizedError('Verify your email address before signing in.');

    // If MFA is enabled on this account, the password alone is not enough.
    // We challenge the caller for a 6-digit TOTP code.
    if (this.mfaService && await this.mfaService.isEnabled(user.id)) {
      if (!dto.mfaToken) {
        throw new MfaRequiredError();
      }
      const codeOk = await this.mfaService.checkCode(user.id, dto.mfaToken);
      if (!codeOk) {
        throw new InvalidMfaCodeError();
      }
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.isAdmin, undefined, user.sessionVersion);

    return {
      user: this.toAuthUserResponse(user),
      tokens,
    };
  }

  async oauthLogin(dto: OAuthLoginDto): Promise<{ user: AuthUserResponse; tokens: TokenPair }> {
    // Check if this OAuth account already exists
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      // Existing OAuth user: check not deleted
      if (existingOAuth.user.deletedAt) {
        throw new UnauthorizedError('This account has been deactivated.');
      }

      if (await this.mfaService?.isEnabled(existingOAuth.user.id)) {
        if (!dto.mfaToken) throw new MfaRequiredError();
        if (!await this.mfaService!.checkCode(existingOAuth.user.id, dto.mfaToken)) throw new InvalidMfaCodeError();
      }
      const tokens = await this.issueTokenPair(
        existingOAuth.user.id,
        existingOAuth.user.email,
        existingOAuth.user.isAdmin,
        undefined, existingOAuth.user.sessionVersion,
      );

      return {
        user: this.toAuthUserResponse(existingOAuth.user),
        tokens,
      };
    }

    // Check if a user with this email already exists (account linking)
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    if (existingUser) {
      // Never link identities solely on a matching email. Linking needs a
      // separately authenticated account-management flow.
      throw new UnauthorizedError('Sign in using your existing account method. Automatic account linking is disabled.');
    }

    // New user: create account + OAuth link
    if (!dto.firstName || !dto.lastName) {
      throw new ProfileRequiredError();
    }

    const { firstName, lastName } = dto;
    const user = await transaction(async tx => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          emailVerifiedAt: new Date(),
          firstName,
          lastName,
          oauthAccounts: {
            create: { provider: dto.provider, providerAccountId: dto.providerAccountId },
          },
        },
      });
      await enqueueEmail(tx, welcomeEmailPayload({ email: created.email, firstName: created.firstName, locale: dto.locale }));
      return created;
    });

    logger.info(
      { userId: user.id, provider: dto.provider },
      'New user registered via OAuth',
    );

    const tokens = await this.issueTokenPair(user.id, user.email, user.isAdmin, undefined, user.sessionVersion);

    return {
      user: this.toAuthUserResponse(user),
      tokens,
    };
  }

  async refreshToken(token: string): Promise<TokenPair> {
    this.tokenService.verifyRefreshToken(token);
    const result = await transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { token: hashToken(token) } });
      if (!stored) return null;
      await lockResource(tx, `session:${stored.userId}`);
      const claimed = await tx.refreshToken.updateMany({
        where: { id: stored.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        await tx.refreshToken.deleteMany({ where: { familyId: stored.familyId } });
        return null;
      }
      const user = await tx.user.findUnique({ where: { id: stored.userId, deletedAt: null } });
      if (!user) return null;
      const pair = this.makeTokenPair(user.id, user.email, user.isAdmin, stored.familyId, user.sessionVersion);
      await tx.refreshToken.create({ data: { userId: user.id, token: hashToken(pair.refreshToken), familyId: stored.familyId, expiresAt: new Date(Date.now() + refreshLifetimeMs()) } });
      return pair;
    });
    if (!result) throw new UnauthorizedError('Refresh token is invalid, expired or already used.');
    return result;
  }

  async logout(refreshToken: string): Promise<void> {
    const storedToken = await this.authRepository.findByToken(refreshToken);
    if (storedToken) {
      await this.authRepository.revokeFamily(storedToken.familyId);
    }
  }

  async getMe(userId: string): Promise<AuthUserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedError('User account no longer exists.');
    }

    return this.toAuthUserResponse(user);
  }

  async forgotPassword(email: string, locale: AccountLocale = 'en'): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await this.authRepository.createPasswordResetToken(user.id, token, expiresAt,
      passwordResetEmailPayload({ email: user.email, firstName: user.firstName, token, locale }));
    logger.info({ userId: user.id }, 'Password reset requested');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.authRepository.findPasswordResetToken(token);

    if (!resetToken) {
      throw new UnauthorizedError('Invalid or expired reset token.');
    }

    const passwordHash = await this.hashService.hash(newPassword);

    await transaction(async (tx) => {
      await lockResource(tx, `session:${resetToken.userId}`);
      const consumed = await tx.passwordResetToken.updateMany({ where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) throw new UnauthorizedError('Invalid or expired reset token.');
      await tx.user.update({ where: { id: resetToken.userId, deletedAt: null }, data: { passwordHash, sessionVersion: { increment: 1 } } });
      await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
      await tx.refreshToken.deleteMany({ where: { userId: resetToken.userId } });
    });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    isAdmin: boolean,
    familyId?: string,
    sessionVersion = 0,
  ): Promise<TokenPair> {
    const resolvedFamilyId = familyId ?? uuidv4();
    const pair = this.makeTokenPair(userId, email, isAdmin, resolvedFamilyId, sessionVersion);
    await this.authRepository.createRefreshToken({ userId, token: pair.refreshToken, familyId: resolvedFamilyId, sessionVersion, expiresAt: new Date(Date.now() + refreshLifetimeMs()) });
    return pair;
  }

  private makeTokenPair(userId: string, email: string, isAdmin: boolean, familyId: string, sessionVersion: number): TokenPair {
    return {
      accessToken: this.tokenService.signAccessToken({ userId, email, isAdmin, sessionVersion }),
      refreshToken: this.tokenService.signRefreshToken({ userId, familyId }),
    };
  }

  private toAuthUserResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isAdmin: boolean;
    createdAt: Date;
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };
  }
}
