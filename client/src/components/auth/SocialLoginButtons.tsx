import { useAuthDestination } from '@/hooks/useAuthDestination';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface SocialLoginButtonsProps {
  onError?: (message: string) => void;
}

function GoogleLoginButton({
  onError,
  loadingProvider,
  setLoadingProvider,
  onMfaRequired,
  ready,
  onProfileRequired,
}: {
  onError?: (message: string) => void;
  loadingProvider: string | null;
  setLoadingProvider: (p: string | null) => void;
  onMfaRequired: (action: (code: string) => Promise<void>) => void;
  ready: boolean;
  onProfileRequired: (action: (firstName: string, lastName: string) => Promise<void>) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const destination = useAuthDestination();
  const { loginWithGoogle } = useAuth();

  const handleGoogleSuccess = useCallback(async (accessToken: string) => {
    setLoadingProvider('google');
    try {
      await loginWithGoogle(accessToken);
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { message?: string; code?: string };
      if (apiErr.code === 'MFA_REQUIRED') { onMfaRequired((code) => loginWithGoogle(accessToken, code)); return; }
      if (apiErr.code === 'PROFILE_REQUIRED') { onProfileRequired((firstName, lastName) => loginWithGoogle(accessToken, undefined, { firstName, lastName })); return; }
      onError?.(apiErr.message || t('auth.social.googleError'));
    } finally {
      setLoadingProvider(null);
    }
  }, [loginWithGoogle, destination, navigate, onError, setLoadingProvider, onMfaRequired, onProfileRequired, t]);

  const googleLogin = useGoogleLogin({
    onSuccess: (response) => {
      handleGoogleSuccess(response.access_token);
    },
    onError: () => {
      setLoadingProvider(null);
      onError?.(t('auth.social.googleError'));
    },
    onNonOAuthError: (error) => {
      setLoadingProvider(null);
      if (error.type !== 'popup_closed') onError?.(t('auth.social.googleError'));
    },
  });

  return (
    <button
      type="button"
      onClick={() => { onError?.(''); setLoadingProvider('google'); try { googleLogin(); } catch { setLoadingProvider(null); onError?.(t('auth.social.googleError')); } }}
      disabled={!!loadingProvider || !ready}
      className="flex w-full items-center justify-center gap-3 border border-neutral-200 bg-white px-4 py-3.5 text-sm font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loadingProvider === 'google' ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      )}
      {t('auth.social.continueWithGoogle')}
    </button>
  );
}

export function SocialLoginButtons({ onError }: SocialLoginButtonsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const destination = useAuthDestination();
  const { loginWithApple } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [mfaAction, setMfaAction] = useState<((code: string) => Promise<void>) | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [profileAction, setProfileAction] = useState<((firstName: string, lastName: string) => Promise<void>) | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const requestProfile = useCallback((action: (firstName: string, lastName: string) => Promise<void>) => setProfileAction(() => action), []);
  const [googleReady, setGoogleReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [sdkAttempt, setSdkAttempt] = useState(0);
  const requestMfa = useCallback((action: (code: string) => Promise<void>) => setMfaAction(() => action), []);

  const handleAppleLogin = async () => {
    onError?.('');
    setLoadingProvider('apple');
    try {
      const appleAuth = (window as unknown as Record<string, unknown>).AppleID as {
        auth: {
          signIn: () => Promise<{
            authorization: { id_token: string };
            user?: { name?: { firstName?: string; lastName?: string } };
          }>;
        };
      } | undefined;

      if (!appleAuth) {
        onError?.(t('auth.social.appleNotAvailable'));
        return;
      }

      const response = await appleAuth.auth.signIn();
      const { id_token } = response.authorization;
      const firstName = response.user?.name?.firstName;
      const lastName = response.user?.name?.lastName;

      try { await loginWithApple(id_token, firstName, lastName); }
      catch (error) {
        if ((error as { code?: string }).code === 'MFA_REQUIRED') { requestMfa((code) => loginWithApple(id_token, firstName, lastName, code)); return; }
        if ((error as { code?: string }).code === 'PROFILE_REQUIRED') { requestProfile((first, last) => loginWithApple(id_token, first, last)); return; }
        throw error;
      }
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { message?: string; error?: string };
      if (apiErr.error !== 'popup_closed_by_user' && apiErr.message !== 'popup_closed_by_user' && apiErr.error !== 'user_cancelled_authorize') {
        onError?.(apiErr.message || t('auth.social.appleError'));
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID;

  useEffect(() => {
    if (!appleClientId) return;
    let active = true;
    setAppleReady(false);
    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      if (!active) return;
      const apple = (window as unknown as { AppleID?: { auth: { init: (options: Record<string, unknown>) => void } } }).AppleID;
      try {
        if (!apple) throw new Error('Apple SDK unavailable');
        apple.auth.init({ clientId: appleClientId, scope: 'name email', redirectURI: `${window.location.origin}/signin`, usePopup: true });
        setAppleReady(true);
      } catch { setSdkError(true); }
      clearTimeout(timeout);
    };
    script.onerror = () => { if (active) setSdkError(true); clearTimeout(timeout); };
    const timeout = window.setTimeout(() => { if (active) setSdkError(true); }, 15000);
    document.head.appendChild(script);
    return () => { active = false; clearTimeout(timeout); script.remove(); };
  }, [appleClientId, sdkAttempt]);

  if (!googleClientId && !appleClientId) return null;

  return (
    <div className="space-y-3">
      {profileAction && <form className="space-y-3" onSubmit={async event => { event.preventDefault(); if (!firstName.trim() || !lastName.trim()) return; setLoadingProvider('profile'); try { await profileAction(firstName.trim(), lastName.trim()); setProfileAction(null); navigate(destination, { replace: true }); } catch (error) { onError?.((error as Error).message || t('auth.signIn.genericError')); } finally { setLoadingProvider(null); } }}>
        <p className="text-sm">{t('auth.social.completeProfile')}</p>
        <label className="block text-sm">{t('checkout.firstName')}<input autoFocus required maxLength={100} autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} className="mt-2 w-full border p-3" /></label>
        <label className="block text-sm">{t('checkout.lastName')}<input required maxLength={100} autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} className="mt-2 w-full border p-3" /></label>
        <button disabled={!!loadingProvider} className="min-h-11 bg-neutral-900 px-5 py-3 text-white">{t('common.confirm')}</button>
        <button type="button" disabled={!!loadingProvider} className="min-h-11 px-4 underline" onClick={() => { setProfileAction(null); setFirstName(''); setLastName(''); onError?.(''); }}>{t('common.cancel')}</button>
      </form>}
      {mfaAction && <form className="space-y-3" onSubmit={async (event) => { event.preventDefault(); setLoadingProvider('mfa'); try { await mfaAction(mfaCode); setMfaAction(null); setMfaCode(''); navigate(destination, { replace: true }); } catch (error) { onError?.((error as { message?: string }).message ?? t('auth.signIn.genericError')); } finally { setLoadingProvider(null); } }}>
        <label className="block text-sm">{t('auth.signIn.mfaLabel', { defaultValue: 'Authenticator or backup code' })}<input autoFocus autoComplete="one-time-code" required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className="mt-2 w-full border p-3" /></label>
        <button disabled={!!loadingProvider} className="bg-neutral-900 px-5 py-3 text-white">{t('common.confirm')}</button>
        <button type="button" disabled={!!loadingProvider} className="min-h-11 px-4 underline" onClick={() => { setMfaAction(null); setMfaCode(''); onError?.(''); }}>{t('common.cancel')}</button>
      </form>}
      {googleClientId && (
        <GoogleOAuthProvider key={sdkAttempt} clientId={googleClientId} onScriptLoadSuccess={() => setGoogleReady(true)} onScriptLoadError={() => { setGoogleReady(false); setSdkError(true); }}>
        <GoogleLoginButton
          onError={onError}
          onMfaRequired={requestMfa}
          onProfileRequired={requestProfile}
          loadingProvider={loadingProvider || (mfaAction || profileAction ? 'challenge' : null)}
          ready={googleReady}
          setLoadingProvider={setLoadingProvider}
        />
        </GoogleOAuthProvider>
      )}

      {appleClientId && (
        <button
          type="button"
          onClick={handleAppleLogin}
          disabled={!!loadingProvider || !!mfaAction || !!profileAction || !appleReady}
          className="flex w-full items-center justify-center gap-3 border border-neutral-900 bg-neutral-900 px-4 py-3.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingProvider === 'apple' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          )}
          {t('auth.social.continueWithApple')}
        </button>
      )}

      {sdkError && <p role="alert" className="text-sm text-red-700">{t('auth.social.unavailable')} <button type="button" className="min-h-11 underline" disabled={!!loadingProvider} onClick={() => { setSdkError(false); setGoogleReady(false); setSdkAttempt(value => value + 1); }}>{t('common.retry')}</button></p>}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs tracking-widest text-neutral-500 uppercase">
          {t('auth.social.or')}
        </span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
    </div>
  );
}
