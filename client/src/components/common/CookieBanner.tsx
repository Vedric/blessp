import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

const COOKIE_CONSENT_KEY = 'blessp_cookie_consent';

export function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const initialPrompt = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const open = () => { clearTimeout(initialPrompt.current); opener.current = document.activeElement as HTMLElement; setVisible(true); };
    window.addEventListener('cookiepreferences', open);
    return () => window.removeEventListener('cookiepreferences', open);
  }, []);
  useEffect(() => { if (visible && opener.current) rejectButton.current?.focus(); }, [visible]);
  const close = () => { clearTimeout(initialPrompt.current); setVisible(false); opener.current?.focus(); opener.current = null; };

  useEffect(() => {
    let consent: string | null = null;
    try { consent = localStorage.getItem(COOKIE_CONSENT_KEY); } catch { /* storage unavailable */ }
    if (!consent) {
      // Small delay for a smoother entrance
      initialPrompt.current = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(initialPrompt.current);
    }
  }, []);

  const handleAccept = () => {
    try { localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted'); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event('consentchange'));
    close();
  };

  const handleReject = () => {
    try { localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected'); localStorage.removeItem('recentlyViewed'); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event('consentchange'));
    close();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region" aria-label={t('cookie.preferences')}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-100 bg-white px-6 py-5 shadow-lg md:flex md:items-center md:justify-between md:px-10"
        >
          <p className="mb-4 text-sm text-neutral-600 md:mb-0 md:mr-8">
            {t('cookie.message')}{' '}
            <Link
              to="/privacy"
              className="underline underline-offset-2 transition-colors hover:text-neutral-900"
            >
              {t('cookie.learnMore')}
            </Link>
          </p>
          <div className="flex gap-3">
            <Button ref={rejectButton} variant="ghost" size="sm" onClick={handleReject}>
              {t('cookie.reject')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleAccept}>
              {t('cookie.accept')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
