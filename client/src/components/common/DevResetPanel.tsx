import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, X, Trash2, RefreshCw, ShieldOff } from 'lucide-react';

/**
 * Dev-only reset panel. Appears as a floating button bottom-right in
 * development builds, or in any build when ?debug=1 is present in the URL.
 * It never renders in a production build unless explicitly requested via the
 * query flag, which keeps it out of the way of real users.
 */
export function DevResetPanel() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      setEnabled(true);
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') setEnabled(true);
    } catch {
      // ignore
    }
  }, []);

  if (!enabled) return null;

  const clearLocalStorage = () => {
    localStorage.clear();
    setLastAction('localStorage cleared');
  };

  const clearSessionStorage = () => {
    sessionStorage.clear();
    setLastAction('sessionStorage cleared');
  };

  const clearCookies = () => {
    // Expire every cookie on the current origin. The refresh-token cookie is
    // httpOnly so the browser will not let us wipe it from JS; the "Reset
    // everything" action calls /auth/logout to invalidate it server-side.
    document.cookie
      .split(';')
      .map((c) => c.split('=')[0].trim())
      .filter(Boolean)
      .forEach((name) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
      });
    setLastAction('Cookies cleared (httpOnly cookies require a server logout)');
  };

  const hardReload = () => {
    // window.location.reload does not force cache bypass in every browser.
    // Appending a cache-buster and calling replace() lands on the same route
    // with no cached assets.
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  };

  const resetEverything = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore: we are going to reload anyway
    }
    clearLocalStorage();
    clearSessionStorage();
    clearCookies();
    hardReload();
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[200] flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900/90 text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-neutral-800"
        aria-label="Dev tools"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Wrench className="h-4 w-4" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-20 right-4 z-[200] w-80 border border-neutral-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-neutral-500" />
                <span className="text-xs font-medium tracking-widest text-neutral-700 uppercase">
                  Dev tools
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-neutral-500 transition-colors hover:text-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={resetEverything}
                className="flex w-full items-center gap-2 border border-neutral-900 bg-neutral-900 px-3 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Reset everything &amp; reload
              </button>
              <button
                type="button"
                onClick={clearLocalStorage}
                className="flex w-full items-center gap-2 border border-neutral-200 px-3 py-2 text-xs text-neutral-700 uppercase tracking-widest transition-colors hover:bg-neutral-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear localStorage
              </button>
              <button
                type="button"
                onClick={clearSessionStorage}
                className="flex w-full items-center gap-2 border border-neutral-200 px-3 py-2 text-xs text-neutral-700 uppercase tracking-widest transition-colors hover:bg-neutral-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear sessionStorage
              </button>
              <button
                type="button"
                onClick={clearCookies}
                className="flex w-full items-center gap-2 border border-neutral-200 px-3 py-2 text-xs text-neutral-700 uppercase tracking-widest transition-colors hover:bg-neutral-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear cookies
              </button>
              <button
                type="button"
                onClick={hardReload}
                className="flex w-full items-center gap-2 border border-neutral-200 px-3 py-2 text-xs text-neutral-700 uppercase tracking-widest transition-colors hover:bg-neutral-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Hard reload
              </button>
            </div>

            {lastAction && (
              <p className="mt-4 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
                {lastAction}
              </p>
            )}

            <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
              Visible in development, or in any build via <code>?debug=1</code>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
