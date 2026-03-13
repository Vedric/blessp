import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, ChevronDown, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CurrencySelector } from '@/components/common/CurrencySelector';
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

const shopLinks = [
  { label: 'All Products', to: '/shop' },
  { label: 'Hoodies', to: '/shop?category=hoodies' },
  { label: 'Pants', to: '/shop?category=pants' },
  { label: 'Sets', to: '/shop?category=sets' },
];

const careLinks = [
  { label: 'Contact Us', to: '/contact' },
  { label: 'Shipping & Returns', to: '/return-policy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'FAQ', to: '/contact#faq' },
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
              Luxury streetwear for those who move with purpose.
              Every piece is crafted from premium materials, designed to
              elevate your everyday.
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
            <FooterAccordion title="Shop">
              <ul className="space-y-3">
                {shopLinks.map(({ label, to }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-sm text-neutral-400 transition-colors hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterAccordion>
          </motion.div>

          {/* Customer Care column */}
          <motion.div variants={fadeUp}>
            <FooterAccordion title="Customer Care">
              <ul className="space-y-3">
                {careLinks.map(({ label, to }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-sm text-neutral-400 transition-colors hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterAccordion>
          </motion.div>

          {/* Newsletter column */}
          <motion.div variants={fadeUp}>
            <FooterAccordion title="Stay Connected">
              <p className="text-sm text-neutral-400">
                Subscribe for exclusive drops and early access.
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
                  Join
                </button>
              </form>
              {subscribed && (
                <p className="mt-2 text-xs text-[#c8a97e]">
                  Welcome to the family.
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
            &copy; {year} BLE$$ P. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
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
