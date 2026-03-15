import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LanguageOption {
  code: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: 'en', flag: '\ud83c\uddec\ud83c\udde7' },
  { code: 'fr', flag: '\ud83c\uddeb\ud83c\uddf7' },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === i18n.language) ?? languages[0];

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
        className="flex items-center gap-1.5 rounded border border-neutral-700 px-2.5 py-1.5 text-xs font-medium tracking-wider text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-300"
        aria-label="Select language"
      >
        <span>{current.flag}</span>
        <span className="uppercase">{current.code}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute bottom-full left-0 z-50 mb-2 w-40 overflow-hidden border border-neutral-700 bg-neutral-900 shadow-xl"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            {languages.map((opt) => (
              <button
                key={opt.code}
                onClick={() => {
                  i18n.changeLanguage(opt.code);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                  i18n.language === opt.code
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                <span>{opt.flag}</span>
                <span className="font-medium">{t(`language.${opt.code}`)}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
