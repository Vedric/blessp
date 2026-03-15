import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, MapPin, User as UserIcon, Lock, ChevronRight, Crown, CreditCard, Bell, AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LoyaltyBadge } from '@/components/common/LoyaltyBadge';
import type { LoyaltyBalance } from '@/lib/types';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, refreshUser, logout } = useAuth();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaving(true);
    try {
      await api.patch('/users/me', { firstName: firstName.trim(), lastName: lastName.trim() });
      await refreshUser();
      setIsEditingProfile(false);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setProfileError(apiErr.message || t('profile.failedUpdateProfile'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 12) {
      setPasswordError(t('profile.passwordMinLength'));
      return;
    }
    setPasswordSaving(true);
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setPasswordSuccess(t('profile.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setIsChangingPassword(false);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setPasswordError(apiErr.message || t('profile.failedChangePassword'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const inputClass =
    'block w-full border border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors';

  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);

  useEffect(() => {
    api.get<LoyaltyBalance>('/loyalty/balance')
      .then(setLoyaltyBalance)
      .catch(() => { /* Loyalty fetch is non-critical */ });
  }, []);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError(t('profile.deleteAccount.passwordRequired'));
      return;
    }
    setIsDeleting(true);
    try {
      await api.delete('/users/account', { password: deletePassword });
      await logout();
      navigate('/');
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setDeleteError(apiErr.message || t('profile.deleteAccount.error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const navItems = [
    { label: t('profile.nav.orders'), icon: Package, to: '/profile/orders' },
    { label: t('profile.nav.addresses'), icon: MapPin, to: '/profile/addresses' },
    { label: t('profile.nav.paymentMethods'), icon: CreditCard, to: '/profile/payment-methods' },
    { label: t('profile.nav.emailPreferences'), icon: Bell, to: '/profile/email-preferences' },
    { label: t('profile.nav.loyaltyRewards'), icon: Crown, to: '/profile/loyalty' },
  ];

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900 md:text-4xl">
            {t('profile.myAccount')}
          </h1>
          <div className="mt-2 h-px w-12 bg-brand-500" />

          {/* Profile info */}
          <div className="mt-10 border border-neutral-100 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center bg-neutral-100">
                  <UserIcon className="h-6 w-6 text-neutral-400" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-neutral-900">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  <p className="text-sm text-neutral-500">{user?.email}</p>
                  {loyaltyBalance && (
                    <Link to="/profile/loyalty" className="mt-2 inline-block">
                      <LoyaltyBadge
                        tier={loyaltyBalance.tier}
                        points={loyaltyBalance.points}
                      />
                    </Link>
                  )}
                </div>
              </div>
              {!isEditingProfile && (
                <button
                  onClick={() => {
                    setFirstName(user?.firstName || '');
                    setLastName(user?.lastName || '');
                    setIsEditingProfile(true);
                  }}
                  className="text-xs font-medium tracking-widest text-brand-600 uppercase"
                >
                  {t('common.edit')}
                </button>
              )}
            </div>

            {isEditingProfile && (
              <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
                {profileError && (
                  <p className="text-xs text-red-600">{profileError}</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                      {t('checkout.firstName')}
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={cn(inputClass, 'mt-2')}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                      {t('checkout.lastName')}
                    </label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={cn(inputClass, 'mt-2')}
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="bg-neutral-900 px-6 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {profileSaving ? t('common.saving') : t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-6 py-2.5 text-xs font-medium tracking-widest text-neutral-600 uppercase"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Change password */}
          <div className="mt-6 border border-neutral-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-900">
                  {t('profile.password')}
                </span>
              </div>
              {!isChangingPassword && (
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="text-xs font-medium tracking-widest text-brand-600 uppercase"
                >
                  {t('profile.change')}
                </button>
              )}
            </div>

            {isChangingPassword && (
              <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
                {passwordError && (
                  <p className="text-xs text-red-600">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="text-xs text-green-600">{passwordSuccess}</p>
                )}
                <div>
                  <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                    {t('profile.currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={cn(inputClass, 'mt-2')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                    {t('profile.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={cn(inputClass, 'mt-2')}
                    required
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    {t('profile.atLeast12Chars')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="bg-neutral-900 px-6 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {passwordSaving ? t('profile.updating') : t('profile.updatePassword')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordError('');
                    }}
                    className="px-6 py-2.5 text-xs font-medium tracking-widest text-neutral-600 uppercase"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-6 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center justify-between border p-5 transition-colors hover:bg-neutral-50',
                  item.to === '/profile/loyalty'
                    ? 'border-[#c8a97e]/20 bg-gradient-to-r from-[#c8a97e]/5 to-transparent'
                    : 'border-neutral-100',
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      'h-5 w-5',
                      item.to === '/profile/loyalty' ? 'text-[#c8a97e]' : 'text-neutral-400',
                    )}
                  />
                  <span className="text-sm font-medium text-neutral-900">
                    {item.label}
                  </span>
                  {item.to === '/profile/loyalty' && loyaltyBalance && (
                    <span className="text-2xs font-medium text-[#c8a97e]">
                      {loyaltyBalance.points.toLocaleString()} pts
                    </span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            ))}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="mt-10 text-sm text-neutral-500 underline underline-offset-4 transition-colors hover:text-neutral-900"
          >
            {t('common.signOut')}
          </button>

          {/* Delete Account */}
          <div className="mt-12 border border-red-100 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="text-sm font-medium text-red-700">
                {t('profile.deleteAccount.title')}
              </h3>
            </div>
            <p className="mt-3 text-sm text-neutral-500">
              {t('profile.deleteAccount.description')}
            </p>
            <button
              onClick={() => {
                setShowDeleteModal(true);
                setDeletePassword('');
                setDeleteError('');
              }}
              className="mt-4 border border-red-300 px-6 py-2.5 text-xs font-medium tracking-widest text-red-600 uppercase transition-colors hover:bg-red-50"
            >
              {t('profile.deleteAccount.button')}
            </button>
          </div>

          {/* Delete Account Modal */}
          <AnimatePresence>
            {showDeleteModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
                onClick={() => setShowDeleteModal(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-md bg-white p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <h3 className="font-display text-lg font-medium text-neutral-900">
                      {t('profile.deleteAccount.modalTitle')}
                    </h3>
                  </div>

                  <p className="mt-4 text-sm text-neutral-600">
                    {t('profile.deleteAccount.warning')}
                  </p>

                  <form onSubmit={handleDeleteAccount} className="mt-6 space-y-4">
                    {deleteError && (
                      <p className="text-xs text-red-600">{deleteError}</p>
                    )}
                    <div>
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        {t('profile.deleteAccount.confirmPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showDeletePassword ? 'text' : 'password'}
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          className={cn(inputClass, 'mt-2 pr-12')}
                          required
                          placeholder={t('profile.deleteAccount.passwordPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowDeletePassword(!showDeletePassword)}
                          className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600"
                        >
                          {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isDeleting || !deletePassword}
                        className="flex items-center gap-2 bg-red-600 px-6 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
                        {t('profile.deleteAccount.confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(false)}
                        className="px-6 py-2.5 text-xs font-medium tracking-widest text-neutral-600 uppercase transition-colors hover:text-neutral-900"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
