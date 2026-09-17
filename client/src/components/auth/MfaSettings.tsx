import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { MfaOptInPopup } from './MfaOptInPopup';

type MfaStatus = 'not-configured' | 'pending' | 'enabled' | 'refused';

export function MfaSettings() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError(''); setBusy(true);
    try { const result = await api.get<{ status: MfaStatus }>('/auth/mfa/status'); setStatus(result.status); }
    catch { setError(t('mfa.settings.loadFailed')); }
    finally { setBusy(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const disable = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/auth/mfa/disable', { token: token.trim() });
      setToken(''); await logout(); navigate('/signin');
    } catch { setError(t('mfa.errors.invalidCode')); }
    finally { setBusy(false); }
  };

  return <section className="mt-6 border border-neutral-100 p-6" aria-labelledby="mfa-settings-title">
    <h2 id="mfa-settings-title" className="text-sm font-medium text-neutral-900">{t('mfa.settings.title')}</h2>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {status === null ? <button type="button" onClick={load} disabled={busy} className="mt-4 text-sm underline">{busy ? t('common.loading') : t('common.tryAgain')}</button> : status === 'enabled' ? <>
      <p className="mt-3 text-sm text-neutral-600">{t('mfa.settings.enabled')}</p>
      <form onSubmit={disable} className="mt-4 space-y-3">
        <label htmlFor="mfa-disable-code" className="block text-xs font-medium text-neutral-600">{t('mfa.login.codeLabel')}</label>
        <input id="mfa-disable-code" value={token} onChange={e => setToken(e.target.value)} required maxLength={20} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} className="w-full border border-neutral-200 px-4 py-3 text-sm" />
        <p className="text-sm text-neutral-600">{t('mfa.settings.disableHint')}</p>
        <button type="submit" disabled={busy || !token.trim()} className="border border-neutral-300 px-4 py-3 text-sm disabled:opacity-50">{t('mfa.settings.disable')}</button>
      </form>
    </> : <div className="mt-4"><MfaOptInPopup manual /></div>}
  </section>;
}
