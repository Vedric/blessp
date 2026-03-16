import { useState, useMemo, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { cn } from '@/lib/utils';

interface PasswordCheck {
  label: string;
  met: boolean;
}

function usePasswordStrength(password: string) {
  return useMemo(() => {
    const checks: PasswordCheck[] = [
      { label: 'auth.signUp.checks.minLength', met: password.length >= 12 },
      { label: 'auth.signUp.checks.uppercase', met: /[A-Z]/.test(password) },
      { label: 'auth.signUp.checks.lowercase', met: /[a-z]/.test(password) },
      { label: 'auth.signUp.checks.number', met: /[0-9]/.test(password) },
      { label: 'auth.signUp.checks.special', met: /[^A-Za-z0-9]/.test(password) },
    ];

    const metCount = checks.filter((c) => c.met).length;
    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
    let color = 'bg-red-400';

    if (metCount >= 5) {
      strength = 'strong';
      color = 'bg-green-500';
    } else if (metCount >= 4) {
      strength = 'good';
      color = 'bg-[#c8a97e]';
    } else if (metCount >= 3) {
      strength = 'fair';
      color = 'bg-yellow-400';
    }

    const percent = (metCount / checks.length) * 100;

    return { checks, strength, color, percent };
  }, [password]);
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { checks, strength, color, percent } = usePasswordStrength(password);

  const passwordsMatch = password === confirmPassword;
  const confirmTouched = touched.confirmPassword ?? false;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (firstName.trim().length < 2)
      errs.firstName = t('auth.signUp.firstNameMin');
    if (lastName.trim().length < 2)
      errs.lastName = t('auth.signUp.lastNameMin');
    if (!email.trim()) errs.email = t('auth.signUp.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t('auth.signUp.emailInvalid');
    if (password.length < 12)
      errs.password = t('auth.signUp.passwordMin');
    else if (!/[A-Z]/.test(password))
      errs.password = t('auth.signUp.passwordUppercase');
    else if (!/[0-9]/.test(password))
      errs.password = t('auth.signUp.passwordNumber');
    if (confirmPassword && password !== confirmPassword)
      errs.confirmPassword = t('auth.signUp.passwordsMismatch');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    setTouched({ firstName: true, lastName: true, email: true, password: true, confirmPassword: true });
    if (!validate()) return;
    setIsLoading(true);

    try {
      await register({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      navigate('/');
    } catch (err: unknown) {
      const apiErr = err as { message?: string; fields?: Record<string, string[]> };
      if (apiErr.fields) {
        const mapped: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(apiErr.fields)) {
          mapped[key] = msgs[0];
        }
        setErrors(mapped);
      } else {
        setGeneralError(apiErr.message || t('auth.signUp.genericError'));
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
        <div className="mx-auto mb-8 h-[2px] w-12 bg-[#c8a97e]" />

        <div className="text-center">
          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('auth.signUp.title')}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {t('auth.signUp.subtitle')}
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <SocialLoginButtons onError={(msg) => setGeneralError(msg)} />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <AnimatePresence>
            {generalError && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{generalError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
              >
                {t('common.firstName')}
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); clearFieldError('firstName'); }}
                onBlur={() => handleBlur('firstName')}
                className={cn(
                  'mt-2 block w-full border bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                  errors.firstName && touched.firstName ? 'border-red-300' : 'border-neutral-200',
                )}
                placeholder={t('auth.signUp.firstNamePlaceholder')}
              />
              <AnimatePresence>
                {errors.firstName && touched.firstName && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1.5 text-xs text-red-500"
                  >
                    {errors.firstName}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
              >
                {t('common.lastName')}
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); clearFieldError('lastName'); }}
                onBlur={() => handleBlur('lastName')}
                className={cn(
                  'mt-2 block w-full border bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                  errors.lastName && touched.lastName ? 'border-red-300' : 'border-neutral-200',
                )}
                placeholder={t('auth.signUp.lastNamePlaceholder')}
              />
              <AnimatePresence>
                {errors.lastName && touched.lastName && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1.5 text-xs text-red-500"
                  >
                    {errors.lastName}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
            >
              {t('common.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
              onBlur={() => handleBlur('email')}
              className={cn(
                'mt-2 block w-full border bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                errors.email && touched.email ? 'border-red-300' : 'border-neutral-200',
              )}
              placeholder={t('auth.signIn.emailPlaceholder')}
            />
            <AnimatePresence>
              {errors.email && touched.email && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-1.5 text-xs text-red-500"
                >
                  {errors.email}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
            >
              {t('common.password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                onBlur={() => handleBlur('password')}
                className={cn(
                  'mt-2 block w-full border bg-transparent px-4 py-3 pr-12 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                  errors.password && touched.password ? 'border-red-300' : 'border-neutral-200',
                )}
                placeholder={t('auth.signUp.passwordPlaceholder')}
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

            {/* Password strength indicator */}
            <AnimatePresence>
              {password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2.5">
                    {/* Strength bar */}
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <motion.div
                          className={cn('h-full rounded-full', color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                      </div>
                      <span className={cn(
                        'text-xs font-medium capitalize',
                        strength === 'strong' && 'text-green-600',
                        strength === 'good' && 'text-[#c8a97e]',
                        strength === 'fair' && 'text-yellow-600',
                        strength === 'weak' && 'text-red-500',
                      )}>
                        {t(`auth.signUp.strength.${strength}`)}
                      </span>
                    </div>

                    {/* Requirement checklist */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {checks.map((check) => (
                        <div key={check.label} className="flex items-center gap-1.5">
                          <Check
                            size={12}
                            className={cn(
                              'flex-shrink-0 transition-colors',
                              check.met ? 'text-green-500' : 'text-neutral-300',
                            )}
                          />
                          <span className={cn(
                            'text-xs transition-colors',
                            check.met ? 'text-neutral-600' : 'text-neutral-400',
                          )}>
                            {t(check.label)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {errors.password && touched.password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-1.5 text-xs text-red-500"
                >
                  {errors.password}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
            >
              {t('auth.signUp.confirmPassword')}
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                onBlur={() => handleBlur('confirmPassword')}
                className={cn(
                  'mt-2 block w-full border bg-transparent px-4 py-3 pr-12 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors',
                  (errors.confirmPassword && confirmTouched) || (confirmTouched && !passwordsMatch && confirmPassword)
                    ? 'border-red-300'
                    : confirmTouched && passwordsMatch && confirmPassword
                      ? 'border-green-300'
                      : 'border-neutral-200',
                )}
                placeholder={t('auth.signUp.confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <AnimatePresence>
              {confirmTouched && confirmPassword && passwordsMatch && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-1.5 flex items-center gap-1"
                >
                  <Check size={12} className="text-green-500" />
                  <span className="text-xs text-green-600">
                    {t('auth.signUp.passwordsMatch')}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {confirmTouched && confirmPassword && !passwordsMatch && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-1.5 text-xs text-red-500"
                >
                  {t('auth.signUp.passwordsMismatch')}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            type="submit"
            disabled={isLoading || (confirmPassword.length > 0 && !passwordsMatch)}
            className="flex w-full items-center justify-center bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.signUp.submitting')}
              </>
            ) : (
              t('auth.signUp.submitButton')
            )}
          </motion.button>

          <p className="text-center text-xs text-neutral-400">
            {t('auth.signUp.termsAgreement')}{' '}
            <Link to="/terms" className="underline underline-offset-2 transition-colors hover:text-neutral-600">
              {t('auth.signUp.termsLink')}
            </Link>
          </p>
        </form>

        <p className="mt-8 text-center text-sm text-neutral-500">
          {t('auth.signUp.hasAccount')}{' '}
          <Link
            to="/signin"
            className="font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-[#c8a97e]"
          >
            {t('common.signIn')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
