import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Mail,
  Send,
  CheckCircle2,
  ChevronDown,
  Instagram,
  Twitter,
  AlertCircle,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const subjectOptionKeys = [
  'contact.subjects.generalInquiry',
  'contact.subjects.orderSupport',
  'contact.subjects.returnsExchanges',
  'contact.subjects.collaboration',
  'contact.subjects.other',
];

const faqKeys = [
  { questionKey: 'contact.faq.shippingQ', answerKey: 'contact.faq.shippingA' },
  { questionKey: 'contact.faq.returnPolicyQ', answerKey: 'contact.faq.returnPolicyA', hasLink: true, linkTo: '/return-policy', linkTextKey: 'contact.faq.viewReturnPolicy' },
  { questionKey: 'contact.faq.internationalQ', answerKey: 'contact.faq.internationalA' },
  { questionKey: 'contact.faq.trackOrderQ', answerKey: 'contact.faq.trackOrderA' },
  { questionKey: 'contact.faq.trueSizeQ', answerKey: 'contact.faq.trueSizeA' },
];

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export default function ContactPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('contact.validation.nameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('contact.validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('contact.validation.emailInvalid');
    }

    if (!formData.subject) {
      newErrors.subject = t('contact.validation.subjectRequired');
    }

    if (!formData.message.trim()) {
      newErrors.message = t('contact.validation.messageRequired');
    } else if (formData.message.trim().length < 10) {
      newErrors.message = t('contact.validation.messageMinLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    setTouched({ name: true, email: true, subject: true, message: true });
    if (!validate()) {
      const firstErrorField = formRef.current?.querySelector('[data-error="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/contact', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject,
        message: formData.message.trim(),
      });
      setIsSubmitted(true);
    } catch (err: unknown) {
      const apiErr = err as { message?: string; fields?: Record<string, string[]> };
      if (apiErr.fields) {
        const mapped: FormErrors = {};
        for (const [key, msgs] of Object.entries(apiErr.fields)) {
          if (key in formData) {
            mapped[key as keyof FormErrors] = msgs[0];
          }
        }
        setErrors(mapped);
      } else {
        setSubmitError(apiErr.message || t('contact.submitError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    // Validate the specific field on blur for immediate feedback
    const fieldErrors: FormErrors = {};
    if (name === 'name' && !formData.name.trim()) {
      fieldErrors.name = t('contact.validation.nameRequired');
    }
    if (name === 'email') {
      if (!formData.email.trim()) fieldErrors.email = t('contact.validation.emailRequired');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        fieldErrors.email = t('contact.validation.emailInvalid');
    }
    if (name === 'subject' && !formData.subject) {
      fieldErrors.subject = t('contact.validation.subjectRequired');
    }
    if (name === 'message') {
      if (!formData.message.trim()) fieldErrors.message = t('contact.validation.messageRequired');
      else if (formData.message.trim().length < 10)
        fieldErrors.message = t('contact.validation.messageMinLength');
    }
    if (fieldErrors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: fieldErrors[name as keyof FormErrors] }));
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen">
      {/* Breadcrumbs */}
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('common.contact') }]} />
      </div>

      {/* Hero */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-4xl px-4 pt-12 pb-16 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="text-center"
          >
            <motion.div variants={fadeUp} className="flex justify-center">
              <Mail className="h-8 w-8 text-brand-500" />
            </motion.div>
            <motion.h1
              className="font-display mt-4 text-4xl font-light tracking-tight text-neutral-900 md:text-5xl"
              variants={fadeUp}
            >
              {t('contact.title')}
            </motion.h1>
            <motion.p
              className="mt-4 text-base text-neutral-500"
              variants={fadeUp}
            >
              {t('contact.subtitle')}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-5">
          {/* Form */}
          <motion.div
            className="lg:col-span-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              className="font-display text-2xl font-light tracking-tight text-neutral-900"
              variants={fadeUp}
            >
              {t('contact.sendMessage')}
            </motion.h2>
            <motion.div className="mt-2 h-px w-10 bg-brand-500" variants={fadeUp} />

            <AnimatePresence mode="wait">
              {isSubmitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="mt-10 flex flex-col items-center rounded-lg border border-neutral-200 bg-neutral-50 py-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle2 className="h-14 w-14 text-brand-500" />
                  </motion.div>
                  <motion.h3
                    className="font-display mt-6 text-2xl font-light text-neutral-900"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {t('contact.messageSent')}
                  </motion.h3>
                  <motion.p
                    className="mt-3 max-w-sm text-neutral-500"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {t('contact.messageSentDesc')}
                  </motion.p>
                  <motion.button
                    className="mt-8 text-sm font-medium tracking-widest text-brand-600 uppercase transition-colors hover:text-brand-700"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormData({ name: '', email: '', subject: '', message: '' });
                      setTouched({});
                      setErrors({});
                    }}
                  >
                    {t('contact.sendAnother')}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  ref={formRef}
                  onSubmit={handleSubmit}
                  className="mt-8 space-y-6"
                  variants={fadeUp}
                  noValidate
                >
                  {/* Name */}
                  <div data-error={!!errors.name}>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-neutral-700"
                    >
                      {t('contact.form.name')}
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={cn(
                        'mt-2 block w-full border-0 border-b bg-transparent px-0 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:ring-0 transition-colors',
                        errors.name && touched.name
                          ? 'border-red-400'
                          : 'border-neutral-200',
                      )}
                      placeholder={t('contact.form.namePlaceholder')}
                    />
                    <AnimatePresence>
                      {errors.name && touched.name && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-1.5 flex items-center gap-1 text-sm text-red-500"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.name}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Email */}
                  <div data-error={!!errors.email}>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-neutral-700"
                    >
                      {t('common.email')}
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={cn(
                        'mt-2 block w-full border-0 border-b bg-transparent px-0 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:ring-0 transition-colors',
                        errors.email && touched.email
                          ? 'border-red-400'
                          : 'border-neutral-200',
                      )}
                      placeholder={t('contact.form.emailPlaceholder')}
                    />
                    <AnimatePresence>
                      {errors.email && touched.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-1.5 flex items-center gap-1 text-sm text-red-500"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.email}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Subject */}
                  <div data-error={!!errors.subject}>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-neutral-700"
                    >
                      {t('contact.form.subject')}
                    </label>
                    <div className="relative">
                      <select
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={cn(
                          'mt-2 block w-full appearance-none border-0 border-b bg-transparent px-0 py-3 text-neutral-900 focus:border-brand-500 focus:ring-0 transition-colors',
                          !formData.subject && 'text-neutral-400',
                          errors.subject && touched.subject
                            ? 'border-red-400'
                            : 'border-neutral-200',
                        )}
                      >
                        <option value="" disabled>
                          {t('contact.form.selectSubject')}
                        </option>
                        {subjectOptionKeys.map((key) => (
                          <option key={key} value={t(key)}>
                            {t(key)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    </div>
                    <AnimatePresence>
                      {errors.subject && touched.subject && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-1.5 flex items-center gap-1 text-sm text-red-500"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.subject}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Message */}
                  <div data-error={!!errors.message}>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="message"
                        className="block text-sm font-medium text-neutral-700"
                      >
                        {t('contact.form.message')}
                      </label>
                      <span className={cn(
                        'text-xs transition-colors',
                        formData.message.trim().length > 0 && formData.message.trim().length < 10
                          ? 'text-red-400'
                          : 'text-neutral-400',
                      )}>
                        {formData.message.trim().length}/500
                      </span>
                    </div>
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      maxLength={500}
                      value={formData.message}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={cn(
                        'mt-2 block w-full resize-none border-0 border-b bg-transparent px-0 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:ring-0 transition-colors',
                        errors.message && touched.message
                          ? 'border-red-400'
                          : 'border-neutral-200',
                      )}
                      placeholder={t('contact.form.messagePlaceholder')}
                    />
                    <AnimatePresence>
                      {errors.message && touched.message && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="mt-1.5 flex items-center gap-1 text-sm text-red-500"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* API Error */}
                  <AnimatePresence>
                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                          <p className="text-sm text-red-700">{submitError}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      'inline-flex items-center gap-2 bg-neutral-900 px-10 py-4 text-sm font-medium tracking-widest text-white uppercase transition-all duration-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                        />
                        {t('contact.form.sending')}
                      </>
                    ) : (
                      <>
                        {t('contact.form.sendMessage')}
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>

                  <p className="text-xs text-neutral-400">
                    {t('contact.rateLimitNotice')}
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            className="lg:col-span-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              className="font-display text-2xl font-light tracking-tight text-neutral-900"
              variants={fadeUp}
            >
              {t('contact.getInTouch')}
            </motion.h2>
            <motion.div className="mt-2 h-px w-10 bg-brand-500" variants={fadeUp} />

            <motion.div className="mt-8 space-y-8" variants={fadeUp}>
              <div>
                <p className="text-sm font-medium tracking-widest text-neutral-900 uppercase">
                  {t('common.email')}
                </p>
                <a
                  href="mailto:hello@blessp.com"
                  className="mt-2 block text-neutral-600 transition-colors hover:text-brand-600"
                >
                  hello@blessp.com
                </a>
              </div>

              <div>
                <p className="text-sm font-medium tracking-widest text-neutral-900 uppercase">
                  {t('contact.info.returns')}
                </p>
                <a
                  href="mailto:returns@blessp.com"
                  className="mt-2 block text-neutral-600 transition-colors hover:text-brand-600"
                >
                  returns@blessp.com
                </a>
              </div>

              <div>
                <p className="text-sm font-medium tracking-widest text-neutral-900 uppercase">
                  {t('contact.info.followUs')}
                </p>
                <div className="mt-3 flex gap-4">
                  <a
                    href="https://instagram.com/blessp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-all hover:border-brand-500 hover:text-brand-600"
                    aria-label="Instagram"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                  <a
                    href="https://twitter.com/blessp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-all hover:border-brand-500 hover:text-brand-600"
                    aria-label="Twitter"
                  >
                    <Twitter className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium tracking-widest text-neutral-900 uppercase">
                  {t('contact.info.responseTime')}
                </p>
                <p className="mt-2 text-neutral-600">
                  {t('contact.info.responseTimeDesc')}
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.div className="text-center" variants={fadeUp}>
              <h2 className="font-display text-3xl font-light tracking-tight text-neutral-900 md:text-4xl">
                {t('contact.faqTitle')}
              </h2>
              <div className="mx-auto mt-2 h-px w-12 bg-brand-500" />
            </motion.div>

            <motion.div className="mt-12 space-y-0 divide-y divide-neutral-200" variants={fadeUp}>
              {faqKeys.map((faq, index) => (
                <div key={index}>
                  <button
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between py-6 text-left transition-colors hover:text-brand-600"
                  >
                    <span className="pr-8 text-base font-medium text-neutral-900">
                      {t(faq.questionKey)}
                    </span>
                    <motion.div
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <ChevronDown className="h-5 w-5 flex-shrink-0 text-neutral-400" />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="pb-6 text-base leading-relaxed text-neutral-600">
                          <p>{t(faq.answerKey)}</p>
                          {faq.hasLink && (
                            <Link
                              to={faq.linkTo!}
                              className="mt-3 inline-flex text-sm text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                            >
                              {t(faq.linkTextKey!)}
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.p className="text-sm text-neutral-500" variants={fadeUp}>
              {t('contact.lookingForMore')}
            </motion.p>
            <motion.div className="mt-4 flex items-center justify-center gap-6" variants={fadeUp}>
              <Link
                to="/terms"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                {t('footer.termsConditions')}
              </Link>
              <span className="text-neutral-300">|</span>
              <Link
                to="/return-policy"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                {t('footer.returnPolicy')}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
