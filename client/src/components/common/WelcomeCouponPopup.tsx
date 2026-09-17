import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { Copy, Gift, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface StoredCoupon {
  code: string;
  percent: number;
}

const STORAGE_KEY = 'blessp_welcome_coupon';
const DISMISSED_KEY = 'blessp_welcome_coupon_dismissed';

export function WelcomeCouponPopup() {
  const { t } = useTranslation();
  const [coupon, setCoupon] = useState<StoredCoupon | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed === 'true') return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as StoredCoupon;
      if (parsed.code && typeof parsed.percent === 'number') {
        // Small delay so it does not fight the sign-up redirect animation
        const timer = setTimeout(() => setCoupon(parsed), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleClose = (permanent: boolean) => {
    setCoupon(null);
    if (permanent) {
      localStorage.setItem(DISMISSED_KEY, 'true');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleCopy = async () => {
    if (!coupon) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toast.success(t('welcomeCoupon.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('welcomeCoupon.copyFailed'));
    }
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(Boolean(coupon), dialogRef, () => handleClose(false));

  return (
    <AnimatePresence>
      {coupon && (
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-coupon-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center sm:pb-0"
          onClick={() => handleClose(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-md border border-[#a07a52]/40 bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleClose(true)}
              aria-label={t('welcomeCoupon.dismiss')}
              className="absolute right-4 top-4 text-neutral-500 transition-colors hover:text-neutral-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#a07a52]/10">
                <Gift className="h-7 w-7 text-[#80603c]" />
              </div>
              <h2
                id="welcome-coupon-title"
                className="mt-6 font-display text-2xl font-light tracking-tight text-neutral-900"
              >
                {t('welcomeCoupon.title')}
              </h2>
              <div className="mt-2 h-px w-10 bg-[#a07a52]" />
              <p className="mt-5 text-sm leading-relaxed text-neutral-600">
                {t('welcomeCoupon.message', { percent: coupon.percent })}
              </p>

              <div className="mt-6 w-full border border-dashed border-[#a07a52] bg-[#faf7f2] px-5 py-4">
                <p className="text-[10px] font-medium tracking-[0.3em] text-neutral-500 uppercase">
                  {t('welcomeCoupon.codeLabel')}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-lg font-semibold tracking-[0.2em] text-neutral-900">
                    {coupon.code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={t('welcomeCoupon.copy')}
                    className="flex items-center gap-1.5 text-xs font-medium tracking-widest text-neutral-700 uppercase transition-colors hover:text-[#80603c]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        {t('welcomeCoupon.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {t('welcomeCoupon.copy')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-neutral-500">
                {t('welcomeCoupon.terms')}
              </p>

              <button
                type="button"
                onClick={() => handleClose(true)}
                className="mt-6 text-xs font-medium tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-900"
              >
                {t('welcomeCoupon.dontShowAgain')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
