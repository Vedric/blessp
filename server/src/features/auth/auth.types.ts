export interface RegisterDto {
  locale?: 'en' | 'fr';
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginDto {
  email: string;
  password: string;
  mfaToken?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  createdAt: Date;
}

export interface OAuthLoginDto {
  locale?: 'en' | 'fr';
  provider: 'google' | 'apple';
  mfaToken?: string;
  providerAccountId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}
