import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';

const COOKIE_CONSENT_KEY = 'blessp_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay for a smoother entrance
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-100 bg-white px-6 py-5 shadow-lg md:flex md:items-center md:justify-between md:px-10"
        >
          <p className="mb-4 text-sm text-neutral-600 md:mb-0 md:mr-8">
            We use cookies to enhance your browsing experience and analyze site
            traffic. By continuing, you agree to our use of cookies.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" onClick={handleReject}>
              Reject
            </Button>
            <Button variant="primary" size="sm" onClick={handleAccept}>
              Accept
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
