import { EmailAlreadyTakenError, InvalidCredentialsError } from '@core/errors/domain.errors';
import { UnauthorizedError, ValidationError } from '@core/errors/http.errors';
import { makeUserFixture } from '../fixtures/user.fixture';

// Mock the prisma client used directly in AuthService.
// jest.mock is hoisted, so we build the mock object inside the factory.
jest.mock('@core/database/client', () => {
  const mockUser = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const mockOAuthAccount = {
    findUnique: jest.fn(),
    create: jest.fn(),
  };
  return {
    prisma: { user: mockUser, oAuthAccount: mockOAuthAccount },
    getPrismaClient: jest.fn(),
  };
});

jest.mock('@core/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@features/auth/auth.emails', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

// Import after mock registration so the mock is in place
import { AuthService } from '@features/auth/auth.service';
import { AuthRepository } from '@features/auth/auth.repository';
import { HashService } from '@core/security/hash.service';
import { TokenService } from '@core/security/token.service';
import { prisma } from '@core/database/client';

// Typed reference to the mocked prisma client
const mockPrismaUser = prisma.user as unknown as {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

const mockPrismaOAuthAccount = (prisma as any).oAuthAccount as {
  findUnique: jest.Mock;
  create: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;
  let hashService: jest.Mocked<HashService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    jest.clearAllMocks();

    authRepository = {
      createRefreshToken: jest.fn(),
      findByToken: jest.fn(),
      markAsUsed: jest.fn(),
      revokeFamily: jest.fn(),
      findFamilyByToken: jest.fn(),
      deleteExpired: jest.fn(),
      deleteByUserId: jest.fn(),
      createPasswordResetToken: jest.fn(),
      findPasswordResetToken: jest.fn(),
      markPasswordResetTokenUsed: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    hashService = {
      hash: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<HashService>;

    tokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;

    service = new AuthService(authRepository, hashService, tokenService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'Str0ngP@ssword1',
      firstName: 'Bob',
      lastName: 'Martin',
    };

    it('creates a user and returns a token pair on success', async () => {
      const createdUser = makeUserFixture({
        id: 'usr_new-0001',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      mockPrismaUser.findUnique.mockResolvedValueOnce(null);
      hashService.hash.mockResolvedValueOnce('$argon2id$hashed');
      mockPrismaUser.create.mockResolvedValueOnce(createdUser);
      tokenService.signAccessToken.mockReturnValueOnce('access-token-value');
      tokenService.signRefreshToken.mockReturnValueOnce('refresh-token-value');
      authRepository.createRefreshToken.mockResolvedValueOnce(undefined as any);

      const result = await service.register(registerDto);

      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.firstName).toBe(registerDto.firstName);
      expect(result.tokens.accessToken).toBe('access-token-value');
      expect(result.tokens.refreshToken).toBe('refresh-token-value');
      expect(hashService.hash).toHaveBeenCalledWith(registerDto.password);
      expect(mockPrismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerDto.email,
            passwordHash: '$argon2id$hashed',
          }),
        }),
      );
    });

    it('throws EmailAlreadyTakenError when email is already registered', async () => {
      const existingUser = makeUserFixture({ email: registerDto.email });
      mockPrismaUser.findUnique.mockResolvedValueOnce(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(EmailAlreadyTakenError);
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = { email: 'alice@example.com', password: 'Str0ngP@ssword1' };

    it('returns user and token pair on valid credentials', async () => {
      const user = makeUserFixture({ email: loginDto.email });

      mockPrismaUser.findUnique.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValueOnce(true);
      tokenService.signAccessToken.mockReturnValueOnce('access-token-value');
      tokenService.signRefreshToken.mockReturnValueOnce('refresh-token-value');
      authRepository.createRefreshToken.mockResolvedValueOnce(undefined as any);

      const result = await service.login(loginDto);

      expect(result.user.email).toBe(loginDto.email);
      expect(result.tokens.accessToken).toBe('access-token-value');
      expect(result.tokens.refreshToken).toBe('refresh-token-value');
      expect(hashService.verify).toHaveBeenCalledWith(user.passwordHash, loginDto.password);
    });

    it('throws InvalidCredentialsError when email does not exist', async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(service.login(loginDto)).rejects.toThrow(InvalidCredentialsError);
      expect(hashService.verify).not.toHaveBeenCalled();
    });

    it('throws InvalidCredentialsError when password is wrong', async () => {
      const user = makeUserFixture({ email: loginDto.email });
      mockPrismaUser.findUnique.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValueOnce(false);

      await expect(service.login(loginDto)).rejects.toThrow(InvalidCredentialsError);
    });

    it('returns the same error type for wrong email and wrong password (no user enumeration)', async () => {
      // Wrong email
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);
      const wrongEmailError = await service.login(loginDto).catch((e) => e);

      // Wrong password
      const user = makeUserFixture({ email: loginDto.email });
      mockPrismaUser.findUnique.mockResolvedValueOnce(user);
      hashService.verify.mockResolvedValueOnce(false);
      const wrongPasswordError = await service.login(loginDto).catch((e) => e);

      expect(wrongEmailError).toBeInstanceOf(InvalidCredentialsError);
      expect(wrongPasswordError).toBeInstanceOf(InvalidCredentialsError);
      expect(wrongEmailError.message).toBe(wrongPasswordError.message);
    });
  });

  describe('refreshToken', () => {
    const tokenValue = 'stored-refresh-token';

    it('rotates the refresh token and returns a new token pair', async () => {
      const storedToken = {
        id: 'rt_001',
        userId: 'usr_default-0001',
        token: tokenValue,
        familyId: 'family_001',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        createdAt: new Date(),
      };
      const user = makeUserFixture({ id: storedToken.userId });

      authRepository.findByToken.mockResolvedValueOnce(storedToken as any);
      authRepository.markAsUsed.mockResolvedValueOnce(undefined as any);
      mockPrismaUser.findUnique.mockResolvedValueOnce(user);
      tokenService.signAccessToken.mockReturnValueOnce('new-access-token');
      tokenService.signRefreshToken.mockReturnValueOnce('new-refresh-token');
      authRepository.createRefreshToken.mockResolvedValueOnce(undefined as any);

      const result = await service.refreshToken(tokenValue);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(authRepository.markAsUsed).toHaveBeenCalledWith(storedToken.id);
      expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: storedToken.familyId }),
      );
    });

    it('revokes the family and throws when a reused token is detected', async () => {
      const storedToken = {
        id: 'rt_001',
        userId: 'usr_default-0001',
        token: tokenValue,
        familyId: 'family_001',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: new Date(), // already used
        createdAt: new Date(),
      };

      authRepository.findByToken.mockResolvedValueOnce(storedToken as any);

      await expect(service.refreshToken(tokenValue)).rejects.toThrow(UnauthorizedError);
      expect(authRepository.revokeFamily).toHaveBeenCalledWith(storedToken.familyId);
    });

    it('revokes the family when the token is not found (possible attack)', async () => {
      authRepository.findByToken.mockResolvedValueOnce(null);
      authRepository.findFamilyByToken.mockResolvedValueOnce({ id: 'family_001' });

      await expect(service.refreshToken(tokenValue)).rejects.toThrow(UnauthorizedError);
      expect(authRepository.revokeFamily).toHaveBeenCalledWith('family_001');
    });

    it('throws when the token is not found and no family exists', async () => {
      authRepository.findByToken.mockResolvedValueOnce(null);
      authRepository.findFamilyByToken.mockResolvedValueOnce(null);

      await expect(service.refreshToken(tokenValue)).rejects.toThrow(UnauthorizedError);
      expect(authRepository.revokeFamily).not.toHaveBeenCalled();
    });

    it('throws when the refresh token has expired', async () => {
      const expiredToken = {
        id: 'rt_001',
        userId: 'usr_default-0001',
        token: tokenValue,
        familyId: 'family_001',
        expiresAt: new Date(Date.now() - 86400000),
        usedAt: null,
        createdAt: new Date(),
      };

      authRepository.findByToken.mockResolvedValueOnce(expiredToken as any);

      await expect(service.refreshToken(tokenValue)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('logout', () => {
    it('revokes the token family when the refresh token is found', async () => {
      const storedToken = {
        id: 'rt_001',
        userId: 'usr_default-0001',
        token: 'some-refresh-token',
        familyId: 'family_001',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      };

      authRepository.findByToken.mockResolvedValueOnce(storedToken as any);

      await service.logout('some-refresh-token');

      expect(authRepository.revokeFamily).toHaveBeenCalledWith(storedToken.familyId);
    });

    it('does not throw when the refresh token is not found', async () => {
      authRepository.findByToken.mockResolvedValueOnce(null);

      await expect(service.logout('unknown-token')).resolves.toBeUndefined();
      expect(authRepository.revokeFamily).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken (user deleted)', () => {
    it('throws UnauthorizedError when the user account no longer exists', async () => {
      const storedToken = {
        id: 'rt_001',
        userId: 'usr_deleted',
        token: 'valid-token',
        familyId: 'family_001',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        createdAt: new Date(),
      };

      authRepository.findByToken.mockResolvedValueOnce(storedToken as any);
      authRepository.markAsUsed.mockResolvedValueOnce(undefined as any);
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getMe', () => {
    it('returns the authenticated user profile', async () => {
      const user = makeUserFixture({ id: 'usr_me' });
      mockPrismaUser.findUnique.mockResolvedValueOnce(user);

      const result = await service.getMe('usr_me');

      expect(result.id).toBe('usr_me');
      expect(result.email).toBe(user.email);
    });

    it('throws UnauthorizedError when the user does not exist', async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(service.getMe('usr_gone')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('forgotPassword', () => {
    it('creates a password reset token when the user exists', async () => {
      const user = makeUserFixture({ id: 'usr_forgot' });
      mockPrismaUser.findUnique.mockResolvedValueOnce(user);
      authRepository.createPasswordResetToken.mockResolvedValueOnce(undefined as any);

      await service.forgotPassword(user.email);

      expect(authRepository.createPasswordResetToken).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        expect.any(Date),
      );
    });

    it('silently succeeds when the email does not exist (no user enumeration)', async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(service.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
      expect(authRepository.createPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('resets the password and revokes all sessions', async () => {
      const resetToken = {
        id: 'prt_001',
        userId: 'usr_reset',
        token: 'reset-token-value',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };

      authRepository.findPasswordResetToken.mockResolvedValueOnce(resetToken as any);
      hashService.hash.mockResolvedValueOnce('$argon2id$new-hash');
      mockPrismaUser.update.mockResolvedValueOnce(undefined as any);
      authRepository.markPasswordResetTokenUsed.mockResolvedValueOnce(undefined as any);
      authRepository.deleteByUserId.mockResolvedValueOnce(undefined as any);

      await service.resetPassword('reset-token-value', 'NewStr0ngP@ssword');

      expect(hashService.hash).toHaveBeenCalledWith('NewStr0ngP@ssword');
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usr_reset' },
          data: { passwordHash: '$argon2id$new-hash' },
        }),
      );
      expect(authRepository.markPasswordResetTokenUsed).toHaveBeenCalledWith('prt_001');
      expect(authRepository.deleteByUserId).toHaveBeenCalledWith('usr_reset');
    });

    it('throws UnauthorizedError when the reset token is invalid', async () => {
      authRepository.findPasswordResetToken.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword('bad-token', 'NewStr0ngP@ssword'),
      ).rejects.toThrow(UnauthorizedError);
      expect(hashService.hash).not.toHaveBeenCalled();
    });
  });

  describe('oauthLogin', () => {
    const oauthDto = {
      provider: 'google' as const,
      providerAccountId: 'google-uid-123',
      email: 'oauth@example.com',
      firstName: 'OAuth',
      lastName: 'User',
    };

    it('returns the existing user when the OAuth account is already linked', async () => {
      const existingUser = makeUserFixture({
        id: 'usr_oauth-0001',
        email: oauthDto.email,
        firstName: oauthDto.firstName,
        lastName: oauthDto.lastName,
      });

      mockPrismaOAuthAccount.findUnique.mockResolvedValueOnce({
        id: 'oauth_001',
        provider: oauthDto.provider,
        providerAccountId: oauthDto.providerAccountId,
        userId: existingUser.id,
        user: existingUser,
      });

      tokenService.signAccessToken.mockReturnValueOnce('access-token');
      tokenService.signRefreshToken.mockReturnValueOnce('refresh-token');
      authRepository.createRefreshToken.mockResolvedValueOnce(undefined as any);

      const result = await service.oauthLogin(oauthDto);

      expect(result.user.email).toBe(oauthDto.email);
      expect(result.tokens.accessToken).toBe('access-token');
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
      expect(mockPrismaOAuthAccount.create).not.toHaveBeenCalled();
    });

    it('links OAuth to an existing email user when the provider is new', async () => {
      const existingUser = makeUserFixture({
        id: 'usr_existing-0001',
        email: oauthDto.email,
      });

      // No existing OAuth link
      mockPrismaOAuthAccount.findUnique.mockResolvedValueOnce(null);
      // Existing user by email
      mockPrismaUser.findUnique.mockResolvedValueOnce(existingUser);
      // Create the OAuth link
      mockPrismaOAuthAccount.create.mockResolvedValueOnce({
        id: 'oauth_002',
        provider: oauthDto.provider,
        providerAccountId: oauthDto.providerAccountId,
        userId: existingUser.id,
      });

      tokenService.signAccessToken.mockReturnValueOnce('access-token');
      tokenService.signRefreshToken.mockReturnValueOnce('refresh-token');
      authRepository.createRefreshToken.mockResolvedValueOnce(undefined as any);

      const result = await service.oauthLogin(oauthDto);

      expect(result.user.id).toBe(existingUser.id);
      expect(mockPrismaOAuthAccount.create).toHaveBeenCalledWith({
        data: {
          userId: existingUser.id,
          provider: oauthDto.provider,
          providerAccountId: oauthDto.providerAccountId,
        },
      });
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });

    it('creates a new user and OAuth link when neither exist', async () => {
      const newUser = makeUserFixture({
        id: 'usr_new-oauth',
        email: oauthDto.email,
        firstName: oauthDto.firstName!,
        lastName: oauthDto.lastName!,
      });

      mockPrismaOAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);
      mockPrismaUser.create.mockResolvedValueOnce(newUser);

      tokenService.signAccessToken.mockReturnValueOnce('access-token');
      tokenService.signRefreshToken.mockReturnValueOnce('refresh-token');
      authRepository.createRefreshToken.mockResolvedValueOnce(undefined as any);

      const result = await service.oauthLogin(oauthDto);

      expect(result.user.email).toBe(oauthDto.email);
      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: oauthDto.email,
          firstName: oauthDto.firstName,
          lastName: oauthDto.lastName,
          oauthAccounts: {
            create: {
              provider: oauthDto.provider,
              providerAccountId: oauthDto.providerAccountId,
            },
          },
        }),
      });
    });

    it('throws UnauthorizedError when the existing OAuth user has been deleted', async () => {
      const deletedUser = makeUserFixture({
        id: 'usr_deleted-oauth',
        email: oauthDto.email,
        deletedAt: new Date('2025-12-01T00:00:00Z'),
      });

      mockPrismaOAuthAccount.findUnique.mockResolvedValueOnce({
        id: 'oauth_003',
        provider: oauthDto.provider,
        providerAccountId: oauthDto.providerAccountId,
        userId: deletedUser.id,
        user: deletedUser,
      });

      const error = await service.oauthLogin(oauthDto).catch((e) => e);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.message).toMatch(/deactivated/);
    });

    it('throws ValidationError when creating a new user without a name', async () => {
      const dtoWithoutName = {
        provider: 'google' as const,
        providerAccountId: 'google-uid-no-name',
        email: 'noname@example.com',
      };

      mockPrismaOAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(service.oauthLogin(dtoWithoutName)).rejects.toThrow(ValidationError);
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });
  });
});
