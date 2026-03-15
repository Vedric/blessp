import { NotFoundError, ConflictError } from '../../core/errors/http.errors';
import { InvalidCredentialsError } from '../../core/errors/domain.errors';
import { HashService } from '../../core/security/hash.service';
import { UsersRepository } from './users.repository';
import { AuthRepository } from '../auth/auth.repository';
import { PaymentsService } from '../payments/payments.service';
import { OrdersRepository } from '../orders/orders.repository';
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

    const updated = await this.usersRepository.update(userId, dto);

    return this.toUserResponse(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const isValid = await this.hashService.verify(user.passwordHash, dto.currentPassword);

    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    const newHash = await this.hashService.hash(dto.newPassword);
    await this.usersRepository.updatePasswordHash(userId, newHash);
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const isValid = await this.hashService.verify(user.passwordHash, dto.password);

    if (!isValid) {
      throw new InvalidCredentialsError();
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
        promotions: true,
        newsletter: true,
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
