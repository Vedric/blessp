import { useAuthDestination } from '@/hooks/useAuthDestination';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { cn } from '@/lib/utils';

export default function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const destination = useAuthDestination();
  const { login, loginWithMfa } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  useDocumentMeta({
    title: t('auth.signIn.title'),
    description: t('auth.signIn.metaDescription', {
      defaultValue: 'Sign in to your BLE$$ P account to manage orders, addresses and saved payment methods.',
    }),
  });

  const validateFields = (): boolean => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = t('auth.signIn.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t('auth.signIn.emailInvalid');
    if (!password) errs.password = t('auth.signIn.passwordRequired');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!mfaRequired && !validateFields()) return;
    setIsLoading(true);

    try {
      if (mfaRequired) {
        const token = mfaCode.trim();
        if (!/^\d{6}$/.test(token) && !/^[A-Z2-9]{5}-[A-Z2-9]{5}$/i.test(token)) {
          setError(t('mfa.errors.invalidCode'));
          setIsLoading(false);
          return;
        }
        await loginWithMfa(email, password, token);
      } else {
        await login(email, password);
      }
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { message?: string; code?: string };
      if (apiErr.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setError('');
      } else if (apiErr.code === 'INVALID_MFA_CODE') {
        setError(t('mfa.errors.invalidCode'));
      } else {
        setError(apiErr.message || t('auth.signIn.invalidCredentials'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Brand accent line */}
        <div className="mx-auto mb-8 h-[2px] w-12 bg-[#a07a52]" />

        <div className="text-center">
          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('auth.signIn.title')}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {t('auth.signIn.subtitle')}
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <SocialLoginButtons onError={(msg) => setError(msg)} />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-red-700">{error}</p>
                    <p className="mt-1 text-xs text-red-500">
                      {t('auth.signIn.checkCredentials')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
            >
              {t('auth.signIn.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                if (error) setError('');
              }}
              className={cn(
                'mt-2 block w-full border bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                fieldErrors.email ? 'border-red-300' : 'border-neutral-200',
              )}
              placeholder={t('auth.signIn.emailPlaceholder')}
            />
            <AnimatePresence>
              {fieldErrors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-1.5 text-xs text-red-500"
                >
                  {fieldErrors.email}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
              >
                {t('auth.signIn.passwordLabel')}
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-[#80603c] transition-colors hover:text-neutral-900"
              >
                {t('auth.signIn.forgotPassword')}
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                  if (error) setError('');
                }}
                className={cn(
                  'mt-2 block w-full border bg-transparent px-4 py-3 pr-12 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                  fieldErrors.password ? 'border-red-300' : 'border-neutral-200',
                )}
                placeholder={t('auth.signIn.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 mt-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-600"
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <AnimatePresence>
              {fieldErrors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-1.5 text-xs text-red-500"
                >
                  {fieldErrors.password}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {mfaRequired && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-[#a07a52]/40 bg-[#faf7f2] px-4 py-4">
                  <p className="text-xs text-neutral-700">{t('mfa.login.challenge')}</p>
                  <label
                    htmlFor="mfa-token"
                    className="mt-3 block text-xs font-medium tracking-widest text-neutral-500 uppercase"
                  >
                    {t('mfa.login.codeLabel')}
                  </label>
                  <input
                    id="mfa-token"
                    type="text"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoComplete="one-time-code"
                    maxLength={20}
                    value={mfaCode}
                    onChange={(e) =>
                      setMfaCode(e.target.value)
                    }
                    className="mt-2 block w-full border border-neutral-200 bg-white px-4 py-3 text-center font-mono text-lg tracking-widest text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-900 focus:outline-none"
                    placeholder="••••••"
                    autoFocus
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signIn.submitting')}
              </>
            ) : (
              t('auth.signIn.submitButton')
            )}
          </motion.button>
        </form>

        <p className="mt-8 text-center text-sm text-neutral-500">
          {t('auth.signIn.noAccount')}{' '}
          <Link
            to="/signup"
            className="font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-[#80603c]"
          >
            {t('common.signUp')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
