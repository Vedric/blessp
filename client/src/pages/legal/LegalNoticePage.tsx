import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const sectionKeys = ['editor', 'publicationDirector', 'hosting'] as const;

export default function LegalNoticePage() {
  const { t } = useTranslation();

  useDocumentMeta({
    title: t('legalNotice.title'),
    description: t('legalNotice.metaDescription'),
  });

  return (
    <div className="min-h-screen">
      {/* Breadcrumbs */}
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: t('common.home'), href: '/' }, { label: t('legalNotice.title') }]} />
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
              <Building2 className="h-8 w-8 text-brand-500" />
            </motion.div>
            <motion.h1
              className="font-display mt-4 text-4xl font-light tracking-tight text-neutral-900 md:text-5xl"
              variants={fadeUp}
            >
              {t('legalNotice.title')}
            </motion.h1>
            <motion.p
              className="mt-4 text-sm tracking-widest text-neutral-500 uppercase"
              variants={fadeUp}
            >
              {t('legalNotice.lastUpdated')}
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
                {t(`legalNotice.sections.${key}.title`)}
              </motion.h2>
              <motion.div className="mt-2 h-px w-10 bg-brand-500" variants={fadeUp} />
              <motion.div
                className="mt-6 space-y-4 text-base leading-relaxed text-neutral-600"
                variants={fadeUp}
              >
                {(t(`legalNotice.sections.${key}.content`) as string).split('\n\n').map((paragraph, pIndex) => (
                  <p key={pIndex}>{paragraph}</p>
                ))}

                {key === 'editor' && (
                  <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                    <p className="font-medium text-neutral-900">BLE$$ P</p>
                    <dl className="mt-3 space-y-3 text-sm">
                      <div>
                        <dt className="text-xs tracking-widest text-neutral-500 uppercase">
                          {t('legalNotice.editorInfo.companyLabel')}
                        </dt>
                        <dd className="mt-0.5 text-neutral-700">{t('legalNotice.editorInfo.company')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs tracking-widest text-neutral-500 uppercase">
                          {t('legalNotice.editorInfo.neqLabel')}
                        </dt>
                        <dd className="mt-0.5 text-neutral-700">{t('legalNotice.editorInfo.neq')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs tracking-widest text-neutral-500 uppercase">
                          {t('legalNotice.editorInfo.addressLabel')}
                        </dt>
                        <dd className="mt-0.5 text-neutral-700">{t('legalNotice.editorInfo.address')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs tracking-widest text-neutral-500 uppercase">
                          {t('legalNotice.editorInfo.phoneLabel')}
                        </dt>
                        <dd className="mt-0.5 text-neutral-700">{t('legalNotice.editorInfo.phone')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs tracking-widest text-neutral-500 uppercase">
                          {t('common.email')}
                        </dt>
                        <dd className="mt-0.5">
                          <a
                            href="mailto:hello@blessp.com"
                            className="text-brand-700 underline underline-offset-4 transition-colors hover:text-brand-700"
                          >
                            hello@blessp.com
                          </a>
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                {key === 'hosting' && (
                  <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-xs tracking-widest text-neutral-500 uppercase">
                          {t('legalNotice.hostingInfo.providerLabel')}
                        </dt>
                        <dd className="mt-0.5 text-neutral-700">{t('legalNotice.hostingInfo.provider')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs tracking-widest text-neutral-500 uppercase">
                          {t('legalNotice.hostingInfo.addressLabel')}
                        </dt>
                        <dd className="mt-0.5 text-neutral-700">{t('legalNotice.hostingInfo.address')}</dd>
                      </div>
                    </dl>
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
              {t('legalNotice.questions')}
            </motion.p>
            <motion.div className="mt-4 flex items-center justify-center gap-6" variants={fadeUp}>
              <Link
                to="/contact"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-700"
              >
                {t('footer.contactUs')}
              </Link>
              <span className="text-neutral-300">|</span>
              <Link
                to="/privacy"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-700"
              >
                {t('privacy.title')}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
