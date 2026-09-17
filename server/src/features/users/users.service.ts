import { EmailVerificationService } from '../auth/email-verification.service';
import { prisma } from '../../core/database/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { NotFoundError, ConflictError, ValidationError, UnauthorizedError } from '../../core/errors/http.errors';
import { InvalidCredentialsError } from '../../core/errors/domain.errors';
import { HashService } from '../../core/security/hash.service';
import { UsersRepository } from './users.repository';
import { AuthRepository } from '../auth/auth.repository';
import { PaymentsService } from '../payments/payments.service';
import { OrdersRepository } from '../orders/orders.repository';
import { MfaService } from '../auth/mfa.service';
import {
  UserResponse,
  UpdateUserDto,
  ChangePasswordDto,
  DeleteAccountDto,
  EmailPreferenceResponse,
  UpdateEmailPreferencesDto,
} from './users.types';
import { logger } from '../../core/observability/logger';

export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly hashService: HashService,
    private readonly mfaService: MfaService,
  ) {}

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return this.toUserResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepository.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictError('An account with this email address already exists.');
      }
    }

    if (dto.email && dto.email !== user.email) {
      await this.requireReauthentication(userId, user.passwordHash, dto.currentPassword, dto.mfaToken);
      await new EmailVerificationService().request(userId, dto.email);
    }
    const updated = await this.usersRepository.update(userId, { firstName: dto.firstName, lastName: dto.lastName });

    return this.toUserResponse(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (!user.passwordHash) {
      throw new ValidationError('Cannot change password for accounts created via social login.', {});
    }

    const isValid = await this.hashService.verify(user.passwordHash, dto.currentPassword);

    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const newHash = await this.hashService.hash(dto.newPassword);
    await this.requireReauthentication(userId, user.passwordHash, dto.currentPassword, dto.mfaToken);
    await transaction(async (tx) => {
      await lockResource(tx, `session:${userId}`);
      await tx.user.update({ where: { id: userId, sessionVersion: user.sessionVersion, deletedAt: null }, data: { passwordHash: newHash, sessionVersion: { increment: 1 } } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
    });
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const mfaEnabled = await this.mfaService.isEnabled(userId);
    if (!user.passwordHash && !mfaEnabled) {
      throw new UnauthorizedError('Set up MFA before deleting a social-login account.');
    }

    if (user.passwordHash) {
      const isValid = await this.hashService.verify(user.passwordHash, dto.password ?? '');

      if (!isValid) {
        throw new InvalidCredentialsError();
      }
    }

    // Second factor: if MFA is enabled, require a valid TOTP code. This
    // stops a leaked password from being enough to nuke an account.
    if (mfaEnabled) {
      if (!dto.mfaToken) {
        throw new UnauthorizedError('A multi-factor authentication code is required to delete the account.');
      }
      const codeOk = await this.mfaService.checkCode(userId, dto.mfaToken);
      if (!codeOk) {
        throw new UnauthorizedError('Invalid multi-factor authentication code.');
      }
    }

    // Revoke all refresh tokens so active sessions are invalidated
    const authRepository = new AuthRepository();
    await authRepository.deleteByUserId(userId);

    // Detach all Stripe payment methods to avoid orphaned records
    const ordersRepository = new OrdersRepository();
    const paymentsService = new PaymentsService(ordersRepository);
    await paymentsService.detachAllPaymentMethods(userId);

    await this.usersRepository.softDelete(userId);

    logger.info({ userId }, 'Account soft-deleted per user request');
  }

  async getEmailPreferences(userId: string): Promise<EmailPreferenceResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const prefs = await this.usersRepository.findEmailPreference(userId);

    // Return defaults when no preferences record exists yet
    if (!prefs) {
      return {
        orderUpdates: true,
        promotions: false,
        newsletter: false,
        loyaltyAlerts: true,
      };
    }

    return {
      orderUpdates: prefs.orderUpdates,
      promotions: prefs.promotions,
      newsletter: prefs.newsletter,
      loyaltyAlerts: prefs.loyaltyAlerts,
    };
  }

  async updateEmailPreferences(
    userId: string,
    dto: UpdateEmailPreferencesDto,
  ): Promise<EmailPreferenceResponse> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const prefs = await this.usersRepository.upsertEmailPreference(userId, dto);

    return {
      orderUpdates: prefs.orderUpdates,
      promotions: prefs.promotions,
      newsletter: prefs.newsletter,
      loyaltyAlerts: prefs.loyaltyAlerts,
    };
  }

  private async requireReauthentication(userId: string, hash: string | null, password?: string, mfaToken?: string): Promise<void> {
    const enabled = await this.mfaService.isEnabled(userId);
    if (hash && (!password || !await this.hashService.verify(hash, password))) throw new InvalidCredentialsError();
    if (enabled && (!mfaToken || !await this.mfaService.checkCode(userId, mfaToken))) throw new UnauthorizedError('A valid second factor is required.');
    if (!hash && !enabled) throw new UnauthorizedError('Set up MFA before changing the email of a social-login account.');
  }

  async exportData(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: {
      email: true, firstName: true, lastName: true, createdAt: true, emailVerifiedAt: true,
      addresses: true, orders: { include: { items: true, statusHistory: true } }, reviews: true,
      emailPreference: true, loyaltyPoints: true, loyaltyTransactions: true,
      cartItems: true, wishlistItems: true,
      oauthAccounts: { select: { provider: true, createdAt: true } },
    } });
    const [newsletter, contactMessages] = await Promise.all([
      prisma.newsletterSubscription.findUnique({ where: { email: user.email }, select: { isActive: true, consentAt: true, consentVersion: true, confirmedAt: true, revokedAt: true } }),
      prisma.contactMessage.findMany({ where: { email: user.email }, select: { name: true, subject: true, message: true, createdAt: true } }),
    ]);
    return { ...user, newsletter, contactMessages };
  }

  private toUserResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
