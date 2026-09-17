import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type Step = 'intro' | 'qr' | 'done';

interface MfaStatusResponse {
  status: 'not-configured' | 'pending' | 'enabled' | 'refused';
}

interface SetupPayload {
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

const REMINDED_KEY = 'blessp_mfa_reminded_at';
const SHOW_AFTER_MS = 6 * 60 * 60 * 1000;

export function MfaOptInPopup({ manual = false }: { manual?: boolean }) {
  const { t, i18n } = useTranslation();
  const fr = i18n.language.startsWith('fr');
  const { isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (manual || !isAuthenticated) return;

    // Respect the "don't show" backlog: if the user has been reminded within
    // the past 6 hours, stay quiet. The backend is the source of truth for
    // the "refused permanently" flag.
    const remindedAt = Number(localStorage.getItem(REMINDED_KEY) ?? 0);
    if (remindedAt && Date.now() - remindedAt < SHOW_AFTER_MS) return;

    let cancelled = false;
    api
      .get<MfaStatusResponse>('/auth/mfa/status')
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'not-configured') {
          // Stagger so the prompt does not fight page-load animations
          setTimeout(() => !cancelled && setOpen(true), 1500);
        }
      })
      .catch(() => {
        // silent: MFA is optional and must never block the app
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, manual]);

  const handleStart = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = await api.post<SetupPayload>('/auth/mfa/setup', {});
      setSetup(payload);
      setStep('qr');
    } catch {
      setError(t('mfa.errors.startFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError(t('mfa.errors.invalidCode'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.post<{ backupCodes: string[] }>('/auth/mfa/verify', { token: code });
      setBackupCodes(result.backupCodes);
      setStep('done');
    } catch {
      setError(t('mfa.errors.invalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemind = () => {
    localStorage.setItem(REMINDED_KEY, String(Date.now()));
    setOpen(false);
  };

  const handleRefuse = async () => {
    setBusy(true);
    try {
      await api.post('/auth/mfa/refuse', {});
      toast.success(t('mfa.refused'));
    } catch {
      // persistent refusal still happens client-side via the "enabled"
      // status check; ignore errors here
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    if (step === 'done') { setOpen(false); setBackupCodes([]); void logout(); }
    else handleRemind();
  };

  useDialogFocus(open, dialogRef, handleClose);

  return (<>
    {manual && <button type="button" onClick={() => { setStep('intro'); setError(''); setCode(''); setOpen(true); }} className="bg-neutral-900 px-4 py-3 text-sm text-white">{t('mfa.intro.enable')}</button>}
    {createPortal(<AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mfa-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center sm:pb-0"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('common.close')}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-700"
            >
              <X className="h-5 w-5" />
            </button>

            {step === 'intro' && (
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#a07a52]/10">
                  <Shield className="h-7 w-7 text-[#80603c]" />
                </div>
                <h2
                  id="mfa-title"
                  className="mt-6 font-display text-2xl font-light tracking-tight text-neutral-900"
                >
                  {t('mfa.intro.title')}
                </h2>
                <div className="mt-2 h-px w-10 bg-[#a07a52]" />
                <p className="mt-5 text-sm leading-relaxed text-neutral-600">
                  {t('mfa.intro.description')}
                </p>
                <ul className="mt-5 space-y-2 text-left text-xs text-neutral-600">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#80603c]" />
                    {t('mfa.intro.benefit1')}
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#80603c]" />
                    {t('mfa.intro.benefit2')}
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#80603c]" />
                    {t('mfa.intro.benefit3')}
                  </li>
                </ul>
                <div className="mt-8 flex w-full flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 bg-neutral-900 px-6 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                    {t('mfa.intro.enable')}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemind}
                    className="text-xs font-medium tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-900"
                  >
                    {t('mfa.intro.later')}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefuse}
                    disabled={busy}
                    className="text-xs text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-600 disabled:opacity-50"
                  >
                    {t('mfa.intro.refuse')}
                  </button>
                </div>
                {error && <p className="mt-4 text-xs text-red-600">{error}</p>}
              </div>
            )}

            {step === 'qr' && setup && (
              <div className="flex flex-col items-center text-center">
                <h2 id="mfa-title" className="font-display text-2xl font-light tracking-tight text-neutral-900">
                  {t('mfa.qr.title')}
                </h2>
                <p className="mt-3 text-sm text-neutral-600">
                  {t('mfa.qr.instructions')}
                </p>
                <img
                  src={setup.qrCodeDataUrl}
                  alt="Authenticator QR code"
                  width={240}
                  height={240}
                  className="mt-5 border border-neutral-100"
                />
                <p className="mt-3 max-w-xs break-all text-[11px] text-neutral-500">
                  {setup.otpauthUrl}
                </p>
                <label
                  htmlFor="mfa-code"
                  className="mt-6 block w-full text-left text-xs font-medium tracking-widest text-neutral-500 uppercase"
                >
                  {t('mfa.qr.enterCode')}
                </label>
                <input
                  id="mfa-code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-2 w-full border border-neutral-200 bg-transparent px-4 py-3 text-center font-mono text-lg tracking-[0.5em] text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  placeholder="••••••"
                />
                {error && <p className="mt-2 w-full text-left text-xs text-red-600">{error}</p>}
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={busy || code.length !== 6}
                  className="mt-5 flex w-full items-center justify-center gap-2 bg-neutral-900 px-6 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t('mfa.qr.verify')}
                </button>
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <h2 id="mfa-title" className="mt-6 font-display text-2xl font-light tracking-tight text-neutral-900">
                  {t('mfa.done.title')}
                </h2>
                <p className="mt-3 text-sm text-neutral-600">{fr ? 'Conservez ces codes de secours dans un endroit sûr. Chaque code est utilisable une seule fois. Vous devrez ensuite vous reconnecter.' : 'Save these recovery codes somewhere safe. Each code can be used once. Sign in again after closing.'}</p>
                <ul aria-label={fr ? 'Codes de secours' : 'Recovery codes'} className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">{backupCodes.map((backup) => <li key={backup}>{backup}</li>)}</ul>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-6 bg-neutral-900 px-8 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
                >
                  {t('common.close')}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>, document.body)}
  </>);
}
