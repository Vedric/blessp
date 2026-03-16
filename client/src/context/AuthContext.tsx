import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api, setAccessToken, clearTokens, getAccessToken } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await api.get<User>('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
      clearTokens();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) return;
    await fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const init = async () => {
      if (getAccessToken()) {
        await fetchUser();
      }
      setIsLoading(false);
    };
    init();
  }, [fetchUser]);

  // Schedule token refresh (every 13 minutes for a 15-minute TTL)
  // The refresh token is sent automatically via httpOnly cookie
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.post<{ tokens: { accessToken: string } }>('/auth/refresh');
        setAccessToken(data.tokens.accessToken);
      } catch {
        setUser(null);
        clearTokens();
      }
    }, 13 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ tokens: { accessToken: string }; user: User }>(
      '/auth/login',
      { email, password },
    );
    setAccessToken(data.tokens.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (data: { email: string; password: string; firstName: string; lastName: string }) => {
      const res = await api.post<{ tokens: { accessToken: string }; user: User }>(
        '/auth/register',
        data,
      );
      setAccessToken(res.tokens.accessToken);
      setUser(res.user);
    },
    [],
  );

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const data = await api.post<{ tokens: { accessToken: string }; user: User }>(
      '/auth/google',
      { idToken },
    );
    setAccessToken(data.tokens.accessToken);
    setUser(data.user);
  }, []);

  const loginWithApple = useCallback(async (idToken: string, firstName?: string, lastName?: string) => {
    const data = await api.post<{ tokens: { accessToken: string }; user: User }>(
      '/auth/apple',
      { idToken, firstName, lastName },
    );
    setAccessToken(data.tokens.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local state even if the server call fails
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.isAdmin ?? false,
        isLoading,
        login,
        register,
        loginWithGoogle,
        loginWithApple,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
