import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import i18n from '@/i18n';
import { api, acceptSessionLogin, beginSessionLogout, clearTokens, getAccessToken, prepareSessionLogin, refreshSession, revokeSession, settleSessionRefresh, subscribeToSessionLogout } from '@/lib/api';
import { mergeGuestCartIntoServerCart } from '@/lib/guestCart';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithMfa: (email: string, password: string, mfaToken: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  loginWithGoogle: (idToken: string, mfaToken?: string, profile?: { firstName: string; lastName: string }) => Promise<void>;
  loginWithApple: (idToken: string, firstName?: string, lastName?: string, mfaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function prepareLogin(): Promise<void> {
  if (!await prepareSessionLogin()) throw new Error(i18n.t('auth.signIn.signOutPending'));
}

function clearCheckoutSession(): void {
  try { sessionStorage.removeItem('blessp_checkout_pending'); sessionStorage.removeItem('blessp_checkout_attempt'); } catch { /* Storage can be unavailable. */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => subscribeToSessionLogout(() => { clearCheckoutSession(); setUser(null); }), []);

  const fetchUser = useCallback(async () => {
    const startedWithToken = getAccessToken();
    try {
      const data = await api.get<User>('/auth/me');
      if (getAccessToken() && (startedWithToken === getAccessToken() || !startedWithToken)) setUser(data);
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
      if (getAccessToken() || await refreshSession()) {
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
        if (!await refreshSession()) { setUser(null); clearTokens(); }
      } catch {
        setUser(null);
        clearTokens();
      }
    }, 13 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    await prepareLogin();
    const data = await api.post<{ tokens: { accessToken: string }; user: User }>(
      '/auth/login',
      { email, password },
    );
    acceptSessionLogin(data.tokens.accessToken);
    // Merge any guest cart before exposing the user so CartContext fetches
    // the already-merged server cart when the auth state flips
    await mergeGuestCartIntoServerCart();
    setUser(data.user);
  }, []);

  const loginWithMfa = useCallback(
    async (email: string, password: string, mfaToken: string) => {
      await prepareLogin();
      const data = await api.post<{ tokens: { accessToken: string }; user: User }>(
        '/auth/login',
        { email, password, mfaToken },
      );
      acceptSessionLogin(data.tokens.accessToken);
      await mergeGuestCartIntoServerCart();
      setUser(data.user);
    },
    [],
  );

  const register = useCallback(
    async (data: { email: string; password: string; firstName: string; lastName: string }) => {
      await api.post('/auth/register', { ...data, locale: i18n.resolvedLanguage === 'fr' ? 'fr' : 'en' });
    },
    [],
  );

  const loginWithGoogle = useCallback(async (idToken: string, mfaToken?: string, profile?: { firstName: string; lastName: string }) => {
    await prepareLogin();
    const data = await api.post<{ tokens: { accessToken: string }; user: User }>(
      '/auth/google',
      { idToken, mfaToken, ...profile, locale: i18n.resolvedLanguage === 'fr' ? 'fr' : 'en' },
    );
    acceptSessionLogin(data.tokens.accessToken);
    await mergeGuestCartIntoServerCart();
    setUser(data.user);
  }, []);

  const loginWithApple = useCallback(async (idToken: string, firstName?: string, lastName?: string, mfaToken?: string) => {
    await prepareLogin();
    const data = await api.post<{ tokens: { accessToken: string }; user: User }>(
      '/auth/apple',
      { idToken, firstName, lastName, mfaToken, locale: i18n.resolvedLanguage === 'fr' ? 'fr' : 'en' },
    );
    acceptSessionLogin(data.tokens.accessToken);
    await mergeGuestCartIntoServerCart();
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    beginSessionLogout();
    setUser(null);
    clearCheckoutSession();
    await settleSessionRefresh();
    await revokeSession();
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
        loginWithMfa,
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
