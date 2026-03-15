import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, ChevronDown, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CurrencySelector } from '@/components/common/CurrencySelector';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { api } from '@/lib/api';

function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const shopLinkKeys = [
  { key: 'footer.allProducts', to: '/shop' },
  { key: 'footer.hoodies', to: '/shop?category=hoodies' },
  { key: 'footer.pants', to: '/shop?category=pants' },
  { key: 'footer.sets', to: '/shop?category=sets' },
];

const careLinkKeys = [
  { key: 'footer.contactUs', to: '/contact' },
  { key: 'footer.shippingReturns', to: '/return-policy' },
  { key: 'footer.termsConditions', to: '/terms' },
  { key: 'footer.faq', to: '/contact#faq' },
];

const socialLinks = [
  { label: 'Facebook', href: 'https://facebook.com', icon: Facebook },
  { label: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { label: 'TikTok', href: 'https://tiktok.com', icon: TikTokIcon },
];

function FooterAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-800 md:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 md:pointer-events-none md:py-0"
      >
        <span className="text-xs font-medium tracking-[0.2em] text-white uppercase">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-neutral-500 transition-transform md:hidden',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 md:mt-6 md:max-h-none md:overflow-visible',
          open ? 'max-h-96 pb-4' : 'max-h-0 md:max-h-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await api.post('/newsletter/subscribe', { email: email.trim() });
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    } catch {
      // Silently handle (toast could be added later)
    }
  };

  return (
    <footer className="border-t border-neutral-800 bg-neutral-950">
      <motion.div
        className="container-page py-16 md:py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        variants={stagger}
      >
        {/* Main footer grid */}
        <div className="grid gap-0 md:grid-cols-2 md:gap-12 lg:grid-cols-4 lg:gap-16">
          {/* Brand column */}
          <motion.div variants={fadeUp} className="mb-8 md:mb-0">
            <Link
              to="/"
              className="font-display text-xl font-semibold tracking-[0.2em] text-white"
            >
              BLE$$ P
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              {t('footer.brandDesc')}
            </p>
            <div className="mt-6 flex items-center gap-4">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 transition-all hover:border-[#c8a97e] hover:text-[#c8a97e]"
                  aria-label={label}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Shop column */}
          <motion.div variants={fadeUp}>
            <FooterAccordion title={t('footer.shop')}>
              <ul className="space-y-3">
                {shopLinkKeys.map(({ key, to }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-sm text-neutral-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:text-white focus-visible:underline"
                    >
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterAccordion>
          </motion.div>

          {/* Customer Care column */}
          <motion.div variants={fadeUp}>
            <FooterAccordion title={t('footer.customerCare')}>
              <ul className="space-y-3">
                {careLinkKeys.map(({ key, to }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-sm text-neutral-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:text-white focus-visible:underline"
                    >
                      {t(key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterAccordion>
          </motion.div>

          {/* Newsletter column */}
          <motion.div variants={fadeUp}>
            <FooterAccordion title={t('footer.stayConnected')}>
              <p className="text-sm text-neutral-400">
                {t('footer.newsletterDesc')}
              </p>
              <form onSubmit={handleSubscribe} className="mt-4 flex gap-0">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="h-11 w-full border border-neutral-700 bg-transparent pl-10 pr-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#c8a97e] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="h-11 bg-[#c8a97e] px-5 text-xs font-medium tracking-widest text-neutral-950 uppercase transition-colors hover:bg-[#b89a6f]"
                >
                  {t('footer.join')}
                </button>
              </form>
              {subscribed && (
                <p className="mt-2 text-xs text-[#c8a97e]">
                  {t('footer.welcomeFamily')}
                </p>
              )}
            </FooterAccordion>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <motion.div
          variants={fadeUp}
          className="mt-12 flex flex-col items-center gap-6 border-t border-neutral-800 pt-8 md:flex-row md:justify-between"
        >
          <p className="text-xs text-neutral-500">
            &copy; {year} BLE$$ P. {t('common.allRightsReserved')}
          </p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <CurrencySelector />
            {/* Payment badges */}
            <span className="flex h-7 items-center rounded border border-neutral-700 px-2.5 text-[10px] font-semibold tracking-wider text-neutral-400">
              VISA
            </span>
            <span className="flex h-7 items-center rounded border border-neutral-700 px-2.5 text-[10px] font-semibold tracking-wider text-neutral-400">
              MC
            </span>
            <span className="flex h-7 items-center rounded border border-neutral-700 px-2.5 text-[10px] font-semibold tracking-wider text-neutral-400">
              AMEX
            </span>
          </div>
        </motion.div>
      </motion.div>
    </footer>
  );
}
