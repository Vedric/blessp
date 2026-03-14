import { useState, useMemo, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface PasswordCheck {
  label: string;
  met: boolean;
}

function usePasswordStrength(password: string) {
  return useMemo(() => {
    const checks: PasswordCheck[] = [
      { label: 'At least 12 characters', met: password.length >= 12 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
      { label: 'One number', met: /[0-9]/.test(password) },
      { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
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
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { checks, strength, color, percent } = usePasswordStrength(password);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (firstName.trim().length < 2)
      errs.firstName = 'First name must be at least 2 characters.';
    if (lastName.trim().length < 2)
      errs.lastName = 'Last name must be at least 2 characters.';
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email.';
    if (password.length < 12)
      errs.password = 'Password must be at least 12 characters.';
    else if (!/[A-Z]/.test(password))
      errs.password = 'Password must contain an uppercase letter.';
    else if (!/[0-9]/.test(password))
      errs.password = 'Password must contain a number.';
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
    setTouched({ firstName: true, lastName: true, email: true, password: true });
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
        setGeneralError(apiErr.message || 'An error occurred. Please try again.');
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
            Create Account
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Join the BLE$$ P community
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
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
                First Name
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
                placeholder="First name"
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
                Last Name
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
                placeholder="Last name"
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
              Email
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
              placeholder="you@example.com"
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
              Password
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
                placeholder="Create a strong password"
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
                        {strength}
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
                            {check.label}
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

          <motion.button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </motion.button>

          <p className="text-center text-xs text-neutral-400">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="underline underline-offset-2 transition-colors hover:text-neutral-600">
              Terms & Conditions
            </Link>
          </p>
        </form>

        <p className="mt-8 text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link
            to="/signin"
            className="font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-[#c8a97e]"
          >
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
