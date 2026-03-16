import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { cn } from '@/lib/utils';

export default function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

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
    if (!validateFields()) return;
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || t('auth.signIn.invalidCredentials'));
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
        <div className="mx-auto mb-8 h-[2px] w-12 bg-[#c8a97e]" />

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
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                if (error) setError('');
              }}
              className={cn(
                'mt-2 block w-full border bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
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
                className="text-xs text-[#c8a97e] transition-colors hover:text-neutral-900"
              >
                {t('auth.signIn.forgotPassword')}
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                  if (error) setError('');
                }}
                className={cn(
                  'mt-2 block w-full border bg-transparent px-4 py-3 pr-12 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                  fieldErrors.password ? 'border-red-300' : 'border-neutral-200',
                )}
                placeholder={t('auth.signIn.passwordPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
            className="font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-[#c8a97e]"
          >
            {t('common.signUp')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
