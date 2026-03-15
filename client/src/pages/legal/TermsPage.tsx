import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const sectionKeys = ['acceptance', 'use', 'accounts', 'products', 'orders', 'shipping', 'returns', 'intellectual', 'limitation', 'changes'] as const;

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      {/* Breadcrumbs */}
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('terms.title') }]} />
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
              <FileText className="h-8 w-8 text-brand-500" />
            </motion.div>
            <motion.h1
              className="font-display mt-4 text-4xl font-light tracking-tight text-neutral-900 md:text-5xl"
              variants={fadeUp}
            >
              {t('terms.title')}
            </motion.h1>
            <motion.p
              className="mt-4 text-sm tracking-widest text-neutral-500 uppercase"
              variants={fadeUp}
            >
              {t('terms.lastUpdated')}
            </motion.p>
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
                {t(`terms.sections.${key}.title`)}
              </motion.h2>
              <motion.div className="mt-2 h-px w-10 bg-brand-500" variants={fadeUp} />
              <motion.div
                className="mt-6 space-y-4 text-base leading-relaxed text-neutral-600"
                variants={fadeUp}
              >
                <p>{t(`terms.sections.${key}.content`)}</p>
                {key === 'returns' && (
                  <p>
                    <Link
                      to="/return-policy"
                      className="inline-flex items-center text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                    >
                      {t('returnPolicy.title')}
                    </Link>
                  </p>
                )}
                {key === 'changes' && (
                  <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                    <p className="font-medium text-neutral-900">BLE$$ P</p>
                    <p className="mt-2 text-neutral-600">
                      {t('common.email')}:{' '}
                      <a
                        href="mailto:hello@blessp.com"
                        className="text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                      >
                        hello@blessp.com
                      </a>
                    </p>
                    <p className="mt-1 text-neutral-600">Montreal, Quebec, Canada</p>
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
              {t('terms.questionsAboutTerms')}
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                to="/contact"
                className="mt-4 inline-flex items-center text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                {t('footer.contactUs')}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
