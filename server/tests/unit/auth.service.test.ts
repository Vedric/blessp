jest.mock('@features/auth/email-verification.service', () => ({ EmailVerificationService: jest.fn().mockImplementation(() => ({ request: jest.fn().mockResolvedValue(undefined) })) }));
import { InvalidCredentialsError } from '@core/errors/domain.errors';
import { UnauthorizedError, ValidationError, ProfileRequiredError } from '@core/errors/http.errors';
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
    for (const mock of Object.values(mockPrismaUser)) mock.mockReset();
    for (const mock of Object.values(mockPrismaOAuthAccount)) mock.mockReset();

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

    it('creates an unverified user without issuing credentials', async () => {
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

      expect(result).toEqual({ created: true });
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
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

    it('returns created:false without creating a user when email is already registered', async () => {
      const existingUser = makeUserFixture({ email: registerDto.email });
      mockPrismaUser.findUnique.mockResolvedValueOnce(existingUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({ created: false });
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
        expect.objectContaining({ to: user.email, html: expect.stringContaining('/reset-password#token=') }),
      );
    });

    it('silently succeeds when the email does not exist (no user enumeration)', async () => {
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(service.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
      expect(authRepository.createPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
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

    it('refuses automatic linking to an existing email user', async () => {
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

      await expect(service.oauthLogin(oauthDto)).rejects.toThrow(UnauthorizedError);
      expect(mockPrismaOAuthAccount.create).not.toHaveBeenCalled();
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

    it('requests profile completion when creating a new user without a name', async () => {
      const dtoWithoutName = {
        provider: 'google' as const,
        providerAccountId: 'google-uid-no-name',
        email: 'noname@example.com',
      };

      mockPrismaOAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrismaUser.findUnique.mockResolvedValueOnce(null);

      await expect(service.oauthLogin(dtoWithoutName)).rejects.toThrow(ProfileRequiredError);
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });
  });
});
