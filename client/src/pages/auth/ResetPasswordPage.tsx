import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const passwordRequirements = [
    { label: t('auth.resetPassword.req12Chars'), met: password.length >= 12 },
    { label: t('auth.resetPassword.reqUppercase'), met: /[A-Z]/.test(password) },
    { label: t('auth.resetPassword.reqNumber'), met: /[0-9]/.test(password) },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.resetPassword.passwordsMismatch'));
      return;
    }

    if (!token) {
      setError(t('auth.resetPassword.tokenMissing'));
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setIsSuccess(true);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || t('auth.resetPassword.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-32">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center">
            <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
              {t('auth.resetPassword.invalidLink')}
            </h1>
            <p className="mt-4 text-sm text-neutral-500">
              {t('auth.resetPassword.invalidLinkDesc')}
            </p>
          </div>

          <div className="mt-10">
            <Link
              to="/forgot-password"
              className="flex w-full items-center justify-center bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
            >
              {t('auth.resetPassword.requestNewLink')}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-32">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center">
          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('auth.resetPassword.title')}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {t('auth.resetPassword.subtitle')}
          </p>
        </div>

        {isSuccess ? (
          <motion.div
            className="mt-10 space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
              {t('auth.resetPassword.successMessage')}
            </div>

            <Link
              to="/signin"
              className="flex w-full items-center justify-center bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
            >
              {t('common.signIn')}
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            {error && (
              <motion.div
                className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
              >
                {t('auth.resetPassword.newPasswordLabel')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 block w-full border border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors"
                placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
              >
                {t('auth.resetPassword.confirmPasswordLabel')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-2 block w-full border border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors"
                placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t('auth.resetPassword.requirements')}
              </p>
              {passwordRequirements.map((req) => (
                <div key={req.label} className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      req.met ? 'text-green-600' : 'text-neutral-400'
                    }
                  >
                    {req.met ? '\u2713' : '\u2022'}
                  </span>
                  <span
                    className={
                      req.met ? 'text-green-700' : 'text-neutral-500'
                    }
                  >
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {isLoading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submitButton')}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-neutral-500">
          {t('auth.resetPassword.rememberPassword')}{' '}
          <Link
            to="/signin"
            className="font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-brand-600"
          >
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
