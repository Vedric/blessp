import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { RotateCcw, CheckCircle2, Clock, Package, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const highlightIcons = [Clock, Package, RotateCcw, CheckCircle2];

const highlightKeys = [
  { labelKey: 'returnPolicy.highlights.window', descKey: 'returnPolicy.highlights.windowDesc' },
  { labelKey: 'returnPolicy.highlights.originalCondition', descKey: 'returnPolicy.highlights.originalConditionDesc' },
  { labelKey: 'returnPolicy.highlights.freeReturns', descKey: 'returnPolicy.highlights.freeReturnsDesc' },
  { labelKey: 'returnPolicy.highlights.refundTime', descKey: 'returnPolicy.highlights.refundTimeDesc' },
];

const sectionKeys = ['overview', 'eligibility', 'condition', 'process', 'refunds', 'exchanges', 'nonReturnable', 'damaged', 'contact'] as const;

export default function ReturnPolicyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      {/* Breadcrumbs */}
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('returnPolicy.title') }]} />
      </div>

      {/* Header */}
      <section className="bg-neutral-50">
        <div className="mx-auto max-w-4xl px-4 pt-12 pb-16 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="text-center"
          >
            <motion.div variants={fadeUp} className="flex justify-center">
              <RotateCcw className="h-8 w-8 text-brand-500" />
            </motion.div>
            <motion.h1
              className="font-display mt-4 text-4xl font-light tracking-tight text-neutral-900 md:text-5xl"
              variants={fadeUp}
            >
              {t('returnPolicy.title')}
            </motion.h1>
            <motion.p
              className="mt-4 text-sm tracking-widest text-neutral-500 uppercase"
              variants={fadeUp}
            >
              {t('returnPolicy.subtitle')}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Highlights */}
      <section className="border-b border-neutral-200">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 gap-8 md:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {highlightKeys.map((item, index) => {
              const Icon = highlightIcons[index];
              return (
                <motion.div key={item.labelKey} className="text-center" variants={fadeUp}>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                    <Icon className="h-5 w-5 text-brand-600" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-neutral-900">{t(item.labelKey)}</p>
                  <p className="mt-1 text-xs text-neutral-500">{t(item.descKey)}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-16">
          {sectionKeys.map((key) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.h2
                className="font-display text-2xl font-light tracking-tight text-neutral-900"
                variants={fadeUp}
              >
                {t(`returnPolicy.sections.${key}.title`)}
              </motion.h2>
              <motion.div className="mt-2 h-px w-10 bg-brand-500" variants={fadeUp} />
              <motion.div
                className="mt-6 space-y-4 text-base leading-relaxed text-neutral-600"
                variants={fadeUp}
              >
                {(t(`returnPolicy.sections.${key}.content`) as string).split('\n\n').map((paragraph, pIndex) => (
                  <p key={pIndex}>{paragraph}</p>
                ))}
                {key === 'contact' && (
                  <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                      <div>
                        <p className="font-medium text-neutral-900">{t('returnPolicy.contactInfo.department')}</p>
                        <p className="mt-2 text-neutral-600">
                          {t('common.email')}:{' '}
                          <a
                            href="mailto:returns@blessp.com"
                            className="text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                          >
                            returns@blessp.com
                          </a>
                        </p>
                        <p className="mt-1 text-neutral-600">
                          {t('returnPolicy.contactInfo.generalInquiries')}{' '}
                          <a
                            href="mailto:hello@blessp.com"
                            className="text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                          >
                            hello@blessp.com
                          </a>
                        </p>
                        <p className="mt-3 text-sm text-neutral-500">
                          {t('returnPolicy.contactInfo.responseTime')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.p className="text-sm text-neutral-500" variants={fadeUp}>
              {t('returnPolicy.needHelp')}
            </motion.p>
            <motion.div className="mt-4 flex items-center justify-center gap-6" variants={fadeUp}>
              <Link
                to="/contact"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                {t('footer.contactUs')}
              </Link>
              <span className="text-neutral-300">|</span>
              <Link
                to="/terms"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                {t('returnPolicy.viewTerms')}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
