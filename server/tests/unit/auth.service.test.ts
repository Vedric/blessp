import { EmailAlreadyTakenError, InvalidCredentialsError } from '@core/errors/domain.errors';
import { UnauthorizedError } from '@core/errors/http.errors';
import { makeUserFixture } from '../fixtures/user.fixture';

// Mock the prisma client used directly in AuthService.
// jest.mock is hoisted, so we build the mock object inside the factory.
jest.mock('@core/database/client', () => {
  const mockUser = {
    findUnique: jest.fn(),
    create: jest.fn(),
  };
  return {
    prisma: { user: mockUser },
    getPrismaClient: jest.fn(),
  };
});

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
});
