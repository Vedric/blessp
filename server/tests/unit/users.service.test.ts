import { UsersService } from '@features/users/users.service';
import { UsersRepository } from '@features/users/users.repository';
import { HashService } from '@core/security/hash.service';
import { NotFoundError, ConflictError } from '@core/errors/http.errors';
import { InvalidCredentialsError } from '@core/errors/domain.errors';
import { makeUserFixture } from '../fixtures/user.fixture';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let hashService: jest.Mocked<HashService>;

  beforeEach(() => {
    jest.clearAllMocks();

    usersRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      updatePasswordHash: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    hashService = {
      hash: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<HashService>;

    service = new UsersService(usersRepository, hashService);
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

      await expect(
        service.updateProfile(user.id, { email: 'newalice@example.com' }),
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
      hashService.verify.mockResolvedValueOnce(true);
      hashService.hash.mockResolvedValueOnce('$argon2id$newhash');
      usersRepository.updatePasswordHash.mockResolvedValueOnce(undefined as any);

      await service.changePassword(user.id, changePasswordDto);

      expect(hashService.verify).toHaveBeenCalledWith(user.passwordHash, changePasswordDto.currentPassword);
      expect(hashService.hash).toHaveBeenCalledWith(changePasswordDto.newPassword);
      expect(usersRepository.updatePasswordHash).toHaveBeenCalledWith(user.id, '$argon2id$newhash');
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
  });
});
