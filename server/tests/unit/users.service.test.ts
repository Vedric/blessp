jest.mock('@core/database/client', () => { const client: any = { user: { update: jest.fn() }, refreshToken: { deleteMany: jest.fn() }, passwordResetToken: { deleteMany: jest.fn() }, $queryRaw: jest.fn() }; client.$transaction = jest.fn((callback: any) => callback(client)); return { prisma: client }; });
jest.mock('@features/auth/email-verification.service', () => ({ EmailVerificationService: jest.fn().mockImplementation(() => ({ request: jest.fn().mockResolvedValue(undefined) })) }));
import { prisma } from '@core/database/client';
jest.mock('@core/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockDeleteByUserId = jest.fn().mockResolvedValue(undefined);
jest.mock('@features/auth/auth.repository', () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    deleteByUserId: mockDeleteByUserId,
  })),
}));

const mockDetachAllPaymentMethods = jest.fn().mockResolvedValue(undefined);
jest.mock('@features/payments/payments.service', () => ({
  PaymentsService: jest.fn().mockImplementation(() => ({
    detachAllPaymentMethods: mockDetachAllPaymentMethods,
  })),
}));

jest.mock('@features/orders/orders.repository');

import { UsersService } from '@features/users/users.service';
import { UsersRepository } from '@features/users/users.repository';
import { HashService } from '@core/security/hash.service';
import { MfaService } from '@features/auth/mfa.service';
import { NotFoundError, ConflictError, UnauthorizedError } from '@core/errors/http.errors';
import { InvalidCredentialsError } from '@core/errors/domain.errors';
import { makeUserFixture } from '../fixtures/user.fixture';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let hashService: jest.Mocked<HashService>;
  let mfaService: jest.Mocked<MfaService>;

  beforeEach(() => {
    jest.clearAllMocks();

    usersRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      updatePasswordHash: jest.fn(),
      softDelete: jest.fn(),
      findEmailPreference: jest.fn(),
      upsertEmailPreference: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    hashService = {
      hash: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<HashService>;

    // MFA is off by default; the deleteAccount MFA branch overrides this
    mfaService = {
      isEnabled: jest.fn().mockResolvedValue(false),
      checkCode: jest.fn(),
    } as unknown as jest.Mocked<MfaService>;

    service = new UsersService(usersRepository, hashService, mfaService);
  });

  describe('getProfile', () => {
    it('returns the user profile when found', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);

      const result = await service.getProfile(user.id);

      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.firstName).toBe(user.firstName);
      expect(result.lastName).toBe(user.lastName);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundError when user does not exist', async () => {
      usersRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getProfile('usr_nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('updates and returns the updated profile', async () => {
      const user = makeUserFixture();
      const updateDto = { firstName: 'Alicia' };
      const updatedUser = makeUserFixture({ ...updateDto, updatedAt: new Date('2025-07-01') });

      usersRepository.findById.mockResolvedValueOnce(user);
      usersRepository.update.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile(user.id, updateDto);

      expect(result.firstName).toBe('Alicia');
      expect(usersRepository.update).toHaveBeenCalledWith(user.id, updateDto);
    });

    it('throws NotFoundError when the user does not exist', async () => {
      usersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateProfile('usr_nonexistent', { firstName: 'Bob' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when the new email is already taken by another account', async () => {
      const user = makeUserFixture({ id: 'usr_001', email: 'alice@example.com' });
      const otherUser = makeUserFixture({ id: 'usr_002', email: 'bob@example.com' });

      usersRepository.findById.mockResolvedValueOnce(user);
      usersRepository.findByEmail.mockResolvedValueOnce(otherUser);

      await expect(
        service.updateProfile(user.id, { email: 'bob@example.com' }),
      ).rejects.toThrow(ConflictError);
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('allows keeping the same email without conflict', async () => {
      const user = makeUserFixture({ id: 'usr_001', email: 'alice@example.com' });
      const updatedUser = makeUserFixture({ ...user });

      usersRepository.findById.mockResolvedValueOnce(user);
      usersRepository.update.mockResolvedValueOnce(updatedUser);

      // Providing the same email should not trigger a conflict check
      await expect(
        service.updateProfile(user.id, { email: 'alice@example.com' }),
      ).resolves.toBeDefined();
    });

    it('allows updating to an email that only belongs to the same user', async () => {
      const user = makeUserFixture({ id: 'usr_001', email: 'alice@example.com' });
      const updatedUser = makeUserFixture({ id: 'usr_001', email: 'newalice@example.com' });

      usersRepository.findById.mockResolvedValueOnce(user);
      // findByEmail returns the same user (same id)
      usersRepository.findByEmail.mockResolvedValueOnce(user);
      usersRepository.update.mockResolvedValueOnce(updatedUser);

      hashService.verify.mockResolvedValueOnce(true);
      await expect(
        service.updateProfile(user.id, { email: 'newalice@example.com', currentPassword: 'OldP@ssword1' }),
      ).resolves.toBeDefined();
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'OldP@ssword1',
      newPassword: 'NewStr0ngP@ss',
    };

    it('hashes and persists the new password on success', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValue(true);
      hashService.hash.mockResolvedValueOnce('$argon2id$newhash');
      usersRepository.updatePasswordHash.mockResolvedValueOnce(undefined as any);

      await service.changePassword(user.id, changePasswordDto);

      expect(hashService.verify).toHaveBeenCalledWith(user.passwordHash, changePasswordDto.currentPassword);
      expect(hashService.hash).toHaveBeenCalledWith(changePasswordDto.newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: user.id, sessionVersion: user.sessionVersion, deletedAt: null }, data: { passwordHash: '$argon2id$newhash', sessionVersion: { increment: 1 } } });
    });

    it('throws NotFoundError when user does not exist', async () => {
      usersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.changePassword('usr_nonexistent', changePasswordDto),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws InvalidCredentialsError when the current password is wrong', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValueOnce(false);

      await expect(
        service.changePassword(user.id, changePasswordDto),
      ).rejects.toThrow(InvalidCredentialsError);
      expect(usersRepository.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('rejects password changes for accounts created via social login', async () => {
      const user = makeUserFixture({ passwordHash: null as unknown as string });
      usersRepository.findById.mockResolvedValueOnce(user);

      await expect(
        service.changePassword(user.id, changePasswordDto),
      ).rejects.toThrow('social login');
      expect(hashService.verify).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    const deleteAccountDto = { password: 'Str0ngP@ssword1' };

    it('throws NotFoundError when user does not exist', async () => {
      usersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.deleteAccount('usr_nonexistent', deleteAccountDto),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws InvalidCredentialsError when the password is wrong', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValueOnce(false);

      await expect(
        service.deleteAccount(user.id, deleteAccountDto),
      ).rejects.toThrow(InvalidCredentialsError);
      expect(usersRepository.softDelete).not.toHaveBeenCalled();
    });

    it('revokes all refresh tokens before soft-deleting the user', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValue(true);
      usersRepository.softDelete.mockResolvedValueOnce(undefined as any);

      await service.deleteAccount(user.id, deleteAccountDto);

      expect(mockDeleteByUserId).toHaveBeenCalledWith(user.id);
    });

    it('detaches all Stripe payment methods before soft-deleting the user', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValue(true);
      usersRepository.softDelete.mockResolvedValueOnce(undefined as any);

      await service.deleteAccount(user.id, deleteAccountDto);

      expect(mockDetachAllPaymentMethods).toHaveBeenCalledWith(user.id);
    });

    it('soft-deletes the user on success', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValue(true);
      usersRepository.softDelete.mockResolvedValueOnce(undefined as any);

      await service.deleteAccount(user.id, deleteAccountDto);

      expect(hashService.verify).toHaveBeenCalledWith(user.passwordHash, deleteAccountDto.password);
      expect(usersRepository.softDelete).toHaveBeenCalledWith(user.id);
    });

    it('deletes an OAuth-only account after verifying MFA without a password', async () => {
      const user = makeUserFixture({ passwordHash: null as unknown as string });
      usersRepository.findById.mockResolvedValueOnce(user);
      mfaService.isEnabled.mockResolvedValueOnce(true);
      mfaService.checkCode.mockResolvedValueOnce(true);
      await service.deleteAccount(user.id, { mfaToken: '123456' });
      expect(hashService.verify).not.toHaveBeenCalled();
      expect(usersRepository.softDelete).toHaveBeenCalledWith(user.id);
    });

    it('requires another factor before deleting OAuth-only accounts', async () => {
      const user = makeUserFixture({ passwordHash: null as unknown as string });
      usersRepository.findById.mockResolvedValueOnce(user);
      usersRepository.softDelete.mockResolvedValueOnce(undefined as any);

      await expect(service.deleteAccount(user.id, deleteAccountDto)).rejects.toThrow('Set up MFA');
      expect(usersRepository.softDelete).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when MFA is enabled and no code is provided', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValue(true);
      mfaService.isEnabled.mockResolvedValueOnce(true);

      await expect(
        service.deleteAccount(user.id, deleteAccountDto),
      ).rejects.toThrow(UnauthorizedError);
      expect(mfaService.checkCode).not.toHaveBeenCalled();
      expect(usersRepository.softDelete).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedError when MFA is enabled and the code is invalid', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValue(true);
      mfaService.isEnabled.mockResolvedValueOnce(true);
      mfaService.checkCode.mockResolvedValueOnce(false);

      await expect(
        service.deleteAccount(user.id, { ...deleteAccountDto, mfaToken: '000000' }),
      ).rejects.toThrow(UnauthorizedError);
      expect(mfaService.checkCode).toHaveBeenCalledWith(user.id, '000000');
      expect(usersRepository.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes the user when MFA is enabled and the code is valid', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValue(true);
      mfaService.isEnabled.mockResolvedValueOnce(true);
      mfaService.checkCode.mockResolvedValueOnce(true);
      usersRepository.softDelete.mockResolvedValueOnce(undefined as any);

      await service.deleteAccount(user.id, { ...deleteAccountDto, mfaToken: '123456' });

      expect(mfaService.checkCode).toHaveBeenCalledWith(user.id, '123456');
      expect(usersRepository.softDelete).toHaveBeenCalledWith(user.id);
    });
  });

  describe('getEmailPreferences', () => {
    it('returns existing preferences when found', async () => {
      const user = makeUserFixture();
      const prefs = {
        id: 'ep_001',
        userId: user.id,
        orderUpdates: false,
        promotions: true,
        newsletter: false,
        loyaltyAlerts: true,
      };

      usersRepository.findById.mockResolvedValueOnce(user);
      usersRepository.findEmailPreference.mockResolvedValueOnce(prefs);

      const result = await service.getEmailPreferences(user.id);

      expect(result).toEqual({
        orderUpdates: false,
        promotions: true,
        newsletter: false,
        loyaltyAlerts: true,
      });
    });

    it('returns default preferences when no record exists', async () => {
      const user = makeUserFixture();
      usersRepository.findById.mockResolvedValueOnce(user);
      usersRepository.findEmailPreference.mockResolvedValueOnce(null);

      const result = await service.getEmailPreferences(user.id);

      expect(result).toEqual({
        orderUpdates: true,
        promotions: false,
        newsletter: false,
        loyaltyAlerts: true,
      });
    });

    it('throws NotFoundError when user does not exist', async () => {
      usersRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getEmailPreferences('usr_nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateEmailPreferences', () => {
    it('updates and returns the new preferences', async () => {
      const user = makeUserFixture();
      const updateDto = { promotions: false, newsletter: false };
      const upsertedPrefs = {
        id: 'ep_001',
        userId: user.id,
        orderUpdates: true,
        promotions: false,
        newsletter: false,
        loyaltyAlerts: true,
      };

      usersRepository.findById.mockResolvedValueOnce(user);
      usersRepository.upsertEmailPreference.mockResolvedValueOnce(upsertedPrefs);

      const result = await service.updateEmailPreferences(user.id, updateDto);

      expect(result).toEqual({
        orderUpdates: true,
        promotions: false,
        newsletter: false,
        loyaltyAlerts: true,
      });
      expect(usersRepository.upsertEmailPreference).toHaveBeenCalledWith(user.id, updateDto);
    });

    it('throws NotFoundError when user does not exist', async () => {
      usersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateEmailPreferences('usr_nonexistent', { promotions: false }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
