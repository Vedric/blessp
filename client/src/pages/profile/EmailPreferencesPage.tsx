import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronLeft, Package, Megaphone, Newspaper, Crown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EmailPreferences {
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
  loyaltyAlerts: boolean;
}

const defaultPreferences: EmailPreferences = {
  orderUpdates: true,
  promotions: false,
  newsletter: false,
  loyaltyAlerts: true,
};

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#c8a97e] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        enabled ? 'bg-[#c8a97e]' : 'bg-neutral-200',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export default function EmailPreferencesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState<EmailPreferences>(defaultPreferences);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const data = await api.get<EmailPreferences>('/users/email-preferences');
        setPreferences(data);
        setSavedPrefs(data);
      } catch {
        // Use defaults if endpoint not available
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreferences();
  }, []);

  useEffect(() => {
    const changed =
      preferences.orderUpdates !== savedPrefs.orderUpdates ||
      preferences.promotions !== savedPrefs.promotions ||
      preferences.newsletter !== savedPrefs.newsletter ||
      preferences.loyaltyAlerts !== savedPrefs.loyaltyAlerts;
    setHasChanges(changed);
    if (changed) setSuccessMessage('');
  }, [preferences, savedPrefs]);

  const handleToggle = (key: keyof EmailPreferences, val: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await api.patch('/users/email-preferences', preferences);
      setSavedPrefs(preferences);
      setSuccessMessage(t('emailPreferences.saved'));
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || t('emailPreferences.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const preferenceItems = [
    {
      key: 'orderUpdates' as const,
      icon: Package,
      title: t('emailPreferences.orderUpdates'),
      description: t('emailPreferences.orderUpdatesDesc'),
    },
    {
      key: 'promotions' as const,
      icon: Megaphone,
      title: t('emailPreferences.promotions'),
      description: t('emailPreferences.promotionsDesc'),
    },
    {
      key: 'newsletter' as const,
      icon: Newspaper,
      title: t('emailPreferences.newsletter'),
      description: t('emailPreferences.newsletterDesc'),
    },
    {
      key: 'loyaltyAlerts' as const,
      icon: Crown,
      title: t('emailPreferences.loyaltyAlerts'),
      description: t('emailPreferences.loyaltyAlertsDesc'),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={() => navigate('/profile')}
            className="mb-6 flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('emailPreferences.backToProfile')}
          </button>

          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('emailPreferences.title')}
          </h1>
          <div className="mt-2 h-px w-12 bg-brand-500" />
          <p className="mt-4 text-sm text-neutral-500">
            {t('emailPreferences.subtitle')}
          </p>

          {error && (
            <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              {successMessage}
            </motion.div>
          )}

          <div className="mt-8 space-y-0 divide-y divide-neutral-100">
            {preferenceItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between py-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-neutral-50">
                    <item.icon className="h-5 w-5 text-neutral-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-neutral-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.description}
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  enabled={preferences[item.key]}
                  onChange={(val) => handleToggle(item.key, val)}
                  disabled={isSaving}
                />
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex items-center gap-2 bg-neutral-900 px-8 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('emailPreferences.save')}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
