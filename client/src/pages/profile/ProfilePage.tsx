import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, MapPin, User as UserIcon, Lock, ChevronRight, Crown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LoyaltyBadge } from '@/components/common/LoyaltyBadge';
import type { LoyaltyBalance } from '@/lib/types';

export default function ProfilePage() {
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
      setProfileError(apiErr.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 12) {
      setPasswordError('New password must be at least 12 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setIsChangingPassword(false);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setPasswordError(apiErr.message || 'Failed to change password.');
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

  const navItems = [
    { label: 'Orders', icon: Package, to: '/profile/orders' },
    { label: 'Addresses', icon: MapPin, to: '/profile/addresses' },
    { label: 'Loyalty Rewards', icon: Crown, to: '/profile/loyalty' },
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
            My Account
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
                  Edit
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
                      First Name
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
                      Last Name
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
                    {profileSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-6 py-2.5 text-xs font-medium tracking-widest text-neutral-600 uppercase"
                  >
                    Cancel
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
                  Password
                </span>
              </div>
              {!isChangingPassword && (
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="text-xs font-medium tracking-widest text-brand-600 uppercase"
                >
                  Change
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
                    Current Password
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
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={cn(inputClass, 'mt-2')}
                    required
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    At least 12 characters.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="bg-neutral-900 px-6 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordError('');
                    }}
                    className="px-6 py-2.5 text-xs font-medium tracking-widest text-neutral-600 uppercase"
                  >
                    Cancel
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
            Sign Out
          </button>
        </motion.div>
      </div>
    </div>
  );
}
