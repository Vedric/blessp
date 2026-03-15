import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Search, ShoppingBag, Mail, FileText, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const popularLinkKeys = [
  { labelKey: 'notFound.shopAll', href: '/shop', icon: ShoppingBag },
  { labelKey: 'notFound.wishlist', href: '/wishlist', icon: Heart },
  { labelKey: 'common.contact', href: '/contact', icon: Mail },
  { labelKey: 'footer.returnPolicy', href: '/return-policy', icon: FileText },
];

export default function NotFoundPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-16">
      {/* Giant 404 background text */}
      <motion.span
        className="pointer-events-none absolute select-none font-display text-[16rem] font-bold leading-none text-neutral-50 sm:text-[20rem] md:text-[28rem]"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        404
      </motion.span>

      {/* Foreground content */}
      <motion.div
        className="relative z-10 flex w-full max-w-lg flex-col items-center text-center"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.p
          className="text-xs font-medium tracking-[0.3em] text-[#c8a97e] uppercase"
          variants={fadeUp}
        >
          {t('notFound.pageNotFound')}
        </motion.p>

        <motion.h1
          className="mt-4 font-display text-4xl font-light tracking-tight text-neutral-900 md:text-5xl"
          variants={fadeUp}
        >
          {t('notFound.lostInStyle')}
        </motion.h1>

        <motion.div
          className="mt-4 h-[2px] w-16 bg-[#c8a97e]"
          variants={fadeUp}
        />

        <motion.p
          className="mt-6 max-w-md text-sm leading-relaxed text-neutral-500"
          variants={fadeUp}
        >
          {t('notFound.description')}
        </motion.p>

        {/* Search bar */}
        <motion.form
          onSubmit={handleSearch}
          className="mt-8 w-full max-w-sm"
          variants={fadeUp}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('notFound.searchPlaceholder')}
              className="w-full border border-neutral-200 bg-white py-3.5 pl-11 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c8a97e] focus:outline-none focus:ring-0 transition-colors"
            />
          </div>
        </motion.form>

        {/* Action buttons */}
        <motion.div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-6" variants={fadeUp}>
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-neutral-900 px-10 py-4 text-sm font-medium tracking-widest text-white uppercase transition-all duration-300 hover:bg-[#c8a97e] hover:text-neutral-950"
          >
            {t('notFound.backToHome')}
          </Link>

          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-[#c8a97e]"
          >
            {t('notFound.browseCollection')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Popular links */}
        <motion.div className="mt-12 w-full" variants={fadeUp}>
          <p className="mb-4 text-xs font-medium tracking-widest text-neutral-400 uppercase">
            {t('notFound.popularPages')}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {popularLinkKeys.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="group flex flex-col items-center gap-2 rounded border border-neutral-100 bg-white/80 px-4 py-4 transition-all hover:border-[#c8a97e]/30 hover:bg-[#c8a97e]/5"
              >
                <link.icon className="h-4 w-4 text-neutral-400 transition-colors group-hover:text-[#c8a97e]" />
                <span className="text-xs font-medium text-neutral-600 transition-colors group-hover:text-neutral-900">
                  {t(link.labelKey)}
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
