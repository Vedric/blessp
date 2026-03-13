import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../core/database/client';
import { EmailAlreadyTakenError, InvalidCredentialsError } from '../../core/errors/domain.errors';
import { UnauthorizedError } from '../../core/errors/http.errors';
import { AuthRepository } from './auth.repository';
import { RegisterDto, LoginDto, TokenPair, AccessTokenPayload, AuthUserResponse } from './auth.types';
import { HashService } from '../../core/security/hash.service';
import { TokenService } from '../../core/security/token.service';
import { logger } from '../../core/observability/logger';

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly hashService: HashService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: AuthUserResponse; tokens: TokenPair }> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new EmailAlreadyTakenError(dto.email);
    }

    const passwordHash = await this.hashService.hash(dto.password);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.isAdmin);

    return {
      user: this.toAuthUserResponse(user),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<{ user: AuthUserResponse; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isValid = await this.hashService.verify(user.passwordHash, dto.password);

    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.isAdmin);

    return {
      user: this.toAuthUserResponse(user),
      tokens,
    };
  }

  async refreshToken(token: string): Promise<TokenPair> {
    const storedToken = await this.authRepository.findByToken(token);

    if (!storedToken) {
      // Token not found: possible reuse attack. Attempt to revoke the family.
      const family = await this.authRepository.findFamilyByToken(token);
      if (family) {
        await this.authRepository.revokeFamily(family.id);
      }
      throw new UnauthorizedError('Refresh token is invalid or has been revoked.');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired.');
    }

    if (storedToken.usedAt !== null) {
      // Reuse detected: revoke the entire token family and force re-authentication.
      await this.authRepository.revokeFamily(storedToken.familyId);
      throw new UnauthorizedError('Refresh token reuse detected. All sessions have been invalidated.');
    }

    await this.authRepository.markAsUsed(storedToken.id);

    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedError('User account no longer exists.');
    }

    return this.issueTokenPair(user.id, user.email, user.isAdmin, storedToken.familyId);
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

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.authRepository.createPasswordResetToken(user.id, token, expiresAt);

    // In production, this would send an email with the reset link.
    // For now, we log the URL so it can be used during development.
    const resetUrl = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/reset-password?token=${token}`;
    logger.info({ userId: user.id, resetUrl }, 'Password reset requested');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.authRepository.findPasswordResetToken(token);

    if (!resetToken) {
      throw new UnauthorizedError('Invalid or expired reset token.');
    }

    const passwordHash = await this.hashService.hash(newPassword);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await this.authRepository.markPasswordResetTokenUsed(resetToken.id);

    // Revoke all refresh tokens so existing sessions are invalidated
    await this.authRepository.deleteByUserId(resetToken.userId);
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    isAdmin: boolean,
    familyId?: string,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = { userId, email, isAdmin };

    const accessToken = this.tokenService.signAccessToken(payload);

    const resolvedFamilyId = familyId ?? uuidv4();
    const refreshPayload = { userId, familyId: resolvedFamilyId };
    const refreshTokenValue = this.tokenService.signRefreshToken(refreshPayload);

    // Refresh token valid for 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.authRepository.createRefreshToken({
      userId,
      token: refreshTokenValue,
      familyId: resolvedFamilyId,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
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
