import { useState, useRef } from 'react';
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
import { cn } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const subjectOptions = [
  'General Inquiry',
  'Order Support',
  'Returns & Exchanges',
  'Collaboration',
  'Other',
];

const faqs = [
  {
    question: 'How long does shipping take?',
    answer:
      'Standard shipping within Canada takes 5 to 7 business days. Expedited shipping is available at checkout for 2 to 3 business day delivery. Orders to the United States typically arrive within 7 to 14 business days.',
  },
  {
    question: 'What is your return policy?',
    answer:
      'We offer a 30-day return window from the date of delivery. Items must be unworn, unwashed, and in their original condition with all tags attached. Visit our Return Policy page for full details.',
    hasLink: true,
    linkTo: '/return-policy',
    linkText: 'View Return Policy',
  },
  {
    question: 'Do you offer international shipping?',
    answer:
      'We currently ship within Canada and the United States. International shipping to additional regions is planned for future expansion. Sign up for our newsletter to stay informed about updates.',
  },
  {
    question: 'How can I track my order?',
    answer:
      'Once your order has shipped, you will receive an email with a tracking number and a link to the carrier\u2019s tracking page. You can also view your order status by logging into your account and visiting the Orders section.',
  },
  {
    question: 'Are your products true to size?',
    answer:
      'Our garments are designed with a relaxed, contemporary fit. We recommend consulting the size guide available on each product page. If you are between sizes, we suggest sizing up for a more relaxed look or sizing down for a fitted silhouette.',
  },
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
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.subject) {
      newErrors.subject = 'Please select a subject.';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required.';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({ name: true, email: true, subject: true, message: true });
    if (!validate()) {
      // Scroll to first error field
      const firstErrorField = formRef.current?.querySelector('[data-error="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);

    // Simulate submission delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSubmitted(true);
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
      fieldErrors.name = 'Name is required.';
    }
    if (name === 'email') {
      if (!formData.email.trim()) fieldErrors.email = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        fieldErrors.email = 'Please enter a valid email address.';
    }
    if (name === 'subject' && !formData.subject) {
      fieldErrors.subject = 'Please select a subject.';
    }
    if (name === 'message') {
      if (!formData.message.trim()) fieldErrors.message = 'Message is required.';
      else if (formData.message.trim().length < 10)
        fieldErrors.message = 'Message must be at least 10 characters.';
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
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />
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
              Contact Us
            </motion.h1>
            <motion.p
              className="mt-4 text-base text-neutral-500"
              variants={fadeUp}
            >
              We would love to hear from you. Reach out with any questions, feedback, or collaboration inquiries.
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
              Send a Message
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
                    Message Sent
                  </motion.h3>
                  <motion.p
                    className="mt-3 max-w-sm text-neutral-500"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    Thank you for reaching out. Our team will get back to you within 24 to 48 business hours.
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
                    Send Another Message
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
                      Name
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
                      placeholder="Your full name"
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
                      Email
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
                      placeholder="your@email.com"
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
                      Subject
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
                          Select a subject
                        </option>
                        {subjectOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
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
                        Message
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
                      placeholder="Tell us how we can help..."
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
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>
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
              Get in Touch
            </motion.h2>
            <motion.div className="mt-2 h-px w-10 bg-brand-500" variants={fadeUp} />

            <motion.div className="mt-8 space-y-8" variants={fadeUp}>
              <div>
                <p className="text-sm font-medium tracking-widest text-neutral-900 uppercase">
                  Email
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
                  Returns
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
                  Follow Us
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
                  Response Time
                </p>
                <p className="mt-2 text-neutral-600">
                  We aim to respond to all inquiries within 24 to 48 business hours.
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
                Frequently Asked Questions
              </h2>
              <div className="mx-auto mt-2 h-px w-12 bg-brand-500" />
            </motion.div>

            <motion.div className="mt-12 space-y-0 divide-y divide-neutral-200" variants={fadeUp}>
              {faqs.map((faq, index) => (
                <div key={index}>
                  <button
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between py-6 text-left transition-colors hover:text-brand-600"
                  >
                    <span className="pr-8 text-base font-medium text-neutral-900">
                      {faq.question}
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
                          <p>{faq.answer}</p>
                          {faq.hasLink && (
                            <Link
                              to={faq.linkTo!}
                              className="mt-3 inline-flex text-sm text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                            >
                              {faq.linkText}
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
              Looking for something else?
            </motion.p>
            <motion.div className="mt-4 flex items-center justify-center gap-6" variants={fadeUp}>
              <Link
                to="/terms"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                Terms & Conditions
              </Link>
              <span className="text-neutral-300">|</span>
              <Link
                to="/return-policy"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                Return Policy
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
