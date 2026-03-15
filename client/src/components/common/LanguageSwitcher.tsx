import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface LanguageOption {
  code: string;
  label: string;
}

const languages: LanguageOption[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === i18n.language) ?? languages[0];
  const other = languages.find((l) => l.code !== current.code)!;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-5 items-center text-[13px] font-medium tracking-wider text-neutral-600 transition-colors hover:text-neutral-900"
        aria-label="Select language"
      >
        {current.label}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-2 overflow-hidden border border-neutral-100 bg-white shadow-lg"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            <button
              onClick={() => {
                i18n.changeLanguage(other.code);
                setIsOpen(false);
              }}
              className="flex w-full items-center px-4 py-2.5 text-xs font-medium tracking-wider text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              {other.label}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
