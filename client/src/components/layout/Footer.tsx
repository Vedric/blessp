import { useState, useId, useRef, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Mail, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { socialLinks } from '@/config/brand';

const shopLinkKeys = [
  { key: 'footer.allProducts', to: '/shop' },
  { key: 'footer.hoodies', to: '/shop?category=hoodies' },
  { key: 'footer.pants', to: '/shop?category=pants' },
  { key: 'footer.sets', to: '/shop?category=sets' },
];

const careLinkKeys = [
  { key: 'footer.contactUs', to: '/contact' },
  { key: 'footer.trackOrder', to: '/order-status' },
  { key: 'footer.shippingReturns', to: '/return-policy' },
  { key: 'footer.termsConditions', to: '/terms' },
  { key: 'footer.privacyPolicy', to: '/privacy' },
  { key: 'footer.legalNotice', to: '/legal-notice' },
  { key: 'footer.faq', to: '/contact#faq' },
];

function FooterAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border-b border-neutral-800 md:border-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between py-4 md:hidden"
      >
        <span className="text-xs font-medium tracking-[0.2em] text-white uppercase">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-neutral-400 transition-transform md:hidden',
            open && 'rotate-180',
          )}
        />
      </button>
      <h2 className="hidden text-xs font-medium uppercase tracking-[0.2em] text-white md:block">{title}</h2>
      <div id={panelId} className={cn('md:mt-6 md:block', open ? 'pb-4' : 'hidden')}>
        {children}
      </div>
    </div>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const emailId = useId();

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || inFlight.current) return;
    setSubscribeError(false); setSubscribed(false);
    // CASL requires express consent: block the request until the subscriber
    // has actively opted in via the checkbox.
    if (!consent) {
      setConsentError(true);
      return;
    }
    inFlight.current = true; setSubmitting(true);
    try {
      await api.post('/newsletter/subscribe', { email: email.trim(), consent: true });
      setSubscribed(true);
      setEmail('');
      setConsent(false);

    } catch {
      setSubscribeError(true);
    } finally { inFlight.current = false; setSubmitting(false); }
  };

  return (
    <footer className="border-t border-neutral-800 bg-[#141510]">
      <div
        className="container-page py-16 md:py-20"
      >
        {/* Main footer grid */}
        <div className="grid gap-0 md:grid-cols-2 md:gap-12 lg:grid-cols-4 lg:gap-16">
          {/* Brand column */}
          <div className="mb-8 md:mb-0">
            <Link
              to="/"
              className="font-display text-xl font-semibold tracking-[0.2em] text-white"
            >
              BLE$$ P
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              {t('footer.brandDesc')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {socialLinks.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 text-xs text-neutral-300 hover:text-white"
                  aria-label={label}
                >
                  {label}<ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop column */}
          <div>
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
          </div>

          {/* Customer Care column */}
          <div>
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
          </div>

          {/* Newsletter column */}
          <div>
            <FooterAccordion title={t('footer.stayConnected')}>
              <p className="text-sm text-neutral-400">
                {t('footer.newsletterDesc')}
              </p>
              <form onSubmit={handleSubscribe} className="mt-4" aria-busy={submitting}>
                <label className="sr-only" htmlFor={emailId}>{t('common.email')}</label>
                <div className="flex gap-0">
                  <div className="relative min-w-0 flex-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      id={emailId}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="h-11 w-full border border-neutral-700 bg-transparent pl-10 pr-3 text-sm text-white placeholder:text-neutral-400 focus:border-[#a07a52] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-11 bg-[#a07a52] px-5 text-xs font-medium tracking-widest text-neutral-950 uppercase transition-colors hover:bg-[#b89a6f]"
                  >
                    {submitting ? t('common.loading') : t('footer.join')}
                  </button>
                </div>
                {/* CASL express opt-in: the subscriber must actively tick this box,
                    which names the sender and states the unsubscribe option, before
                    the request is sent. The box is never pre-checked. */}
                <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      if (e.target.checked) setConsentError(false);
                    }}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#a07a52]"
                  />
                  <span className="text-xs leading-relaxed text-neutral-400">
                    {t('footer.newsletterConsent')}{' '}
                    <Link
                      to="/privacy"
                      className="underline underline-offset-2 transition-colors hover:text-neutral-300"
                    >
                      {t('footer.privacyPolicy')}
                    </Link>
                  </span>
                </label>
              </form>
              {consentError && (
                <p role="alert" className="mt-2 text-xs text-[#d99a8f]">
                  {t('footer.newsletterConsentRequired')}
                </p>
              )}
              {subscribeError && <p role="alert" className="mt-3 text-sm text-[#efb3a9]">{t('footer.subscribeFailed')}</p>}
              {subscribed && (
                <p role="status" className="mt-3 text-sm text-[#dbc29e]">
                  {t('footer.welcomeFamily')}
                </p>
              )}
            </FooterAccordion>
          </div>
        </div>

        {/* Bottom bar */}
        <div

          className="mt-12 flex flex-col items-center gap-6 border-t border-neutral-800 pt-8 md:flex-row md:justify-between"
        >
          <p className="text-xs text-neutral-400">
            &copy; {year} BLE$$ P. {t('common.allRightsReserved')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-neutral-300">
            <button onClick={() => window.dispatchEvent(new Event('cookiepreferences'))} className="min-h-11 underline underline-offset-4 hover:text-white">{t('cookie.preferences')}</button>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('footer.checkoutMethods')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
