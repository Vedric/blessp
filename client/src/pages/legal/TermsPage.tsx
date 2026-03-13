import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const sections = [
  {
    title: '1. Introduction',
    content: `Welcome to BLE$$ P ("we," "our," or "us"). These Terms & Conditions ("Terms") govern your access to and use of our website, mobile applications, and all related services (collectively, the "Site"). By accessing or using the Site, you agree to be bound by these Terms in their entirety. If you do not agree with any part of these Terms, you must discontinue use of the Site immediately.

These Terms constitute a legally binding agreement between you and BLE$$ P. We reserve the right to update or modify these Terms at any time without prior notice. Your continued use of the Site following any changes constitutes acceptance of the revised Terms. We encourage you to review this page periodically.`,
  },
  {
    title: '2. Use of the Site',
    content: `You agree to use the Site solely for lawful purposes and in accordance with these Terms. You may not use the Site in any manner that could damage, disable, overburden, or impair the Site or interfere with any other party's use of the Site.

You are prohibited from: (a) attempting to gain unauthorized access to any portion of the Site or any systems or networks connected to the Site; (b) using any automated means, including robots, crawlers, or scrapers, to access the Site for any purpose without our express written permission; (c) introducing any viruses, trojan horses, worms, or other malicious code; and (d) violating any applicable local, provincial, national, or international law or regulation.`,
  },
  {
    title: '3. Account Registration',
    content: `To access certain features of the Site, including placing orders, you may be required to create an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.

You are responsible for safeguarding the password associated with your account and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account. BLE$$ P cannot and will not be liable for any loss or damage arising from your failure to comply with this obligation.

We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we determine violates these Terms or is harmful to other users, us, or third parties, or for any other reason.`,
  },
  {
    title: '4. Orders & Payments',
    content: `All prices displayed on the Site are listed in Canadian Dollars (CAD) or United States Dollars (USD) and are subject to change without notice. Prices do not include applicable taxes or shipping costs, which will be calculated at checkout.

By placing an order through the Site, you are making an offer to purchase the selected products. We reserve the right to accept or decline your order for any reason, including product availability, errors in pricing or product information, or suspected fraudulent activity.

Payment processing is handled securely through Stripe. By submitting your payment information, you authorize us to charge the applicable amount to your designated payment method. We do not store your full credit card details on our servers. All transactions are encrypted and processed in accordance with industry security standards.

In the event that a product is listed at an incorrect price due to a typographical or system error, we reserve the right to cancel any orders placed at the incorrect price, even if the order has been confirmed.`,
  },
  {
    title: '5. Shipping & Delivery',
    content: `We currently ship within Canada and the United States. Shipping costs and estimated delivery times are displayed at checkout and vary based on your location and the shipping method selected.

While we strive to process and ship orders promptly, delivery timelines are estimates only and are not guaranteed. BLE$$ P is not responsible for delays caused by carriers, customs, weather, or other circumstances beyond our control.

Risk of loss and title for items purchased from the Site pass to you upon delivery of the items to the carrier. If your order is lost or damaged during transit, please contact our support team within 48 hours of the expected delivery date so we can assist with a resolution.`,
  },
  {
    title: '6. Returns & Exchanges',
    content: `We want you to be completely satisfied with your purchase. Our return and exchange policy allows eligible items to be returned within 30 days of delivery. Items must be unworn, unwashed, and in their original condition with all tags attached.

For complete details regarding eligibility, the return process, refund timelines, and non-returnable items, please review our full Return Policy.`,
    hasReturnLink: true,
  },
  {
    title: '7. Intellectual Property',
    content: `All content on the Site, including but not limited to text, graphics, logos, images, photographs, video, audio, software, and the compilation thereof (collectively, "Content"), is the exclusive property of BLE$$ P or its licensors and is protected by Canadian and international copyright, trademark, and other intellectual property laws.

The BLE$$ P name, logo, and all related product and service names, design marks, and slogans are trademarks of BLE$$ P. You may not use these marks without our prior written permission. All other trademarks not owned by BLE$$ P that appear on the Site are the property of their respective owners.

You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Site for personal, non-commercial purposes. This license does not include: (a) any resale or commercial use of the Site or its Content; (b) any collection or use of product listings, descriptions, or prices; (c) any derivative use of the Site or its Content; or (d) any downloading or copying of account information for the benefit of a third party.`,
  },
  {
    title: '8. Limitation of Liability',
    content: `To the fullest extent permitted by applicable law, BLE$$ P, its directors, officers, employees, agents, suppliers, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, arising out of or in connection with: (a) your access to or use of (or inability to access or use) the Site; (b) any conduct or content of any third party on the Site; (c) any content obtained from the Site; or (d) unauthorized access, use, or alteration of your transmissions or content.

In no event shall BLE$$ P's total aggregate liability for all claims arising out of or relating to the use of the Site exceed the amount you have paid to BLE$$ P in the twelve (12) months preceding the event giving rise to the liability.

Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities, so some of the above limitations may not apply to you. In such cases, our liability will be limited to the greatest extent permitted by applicable law.`,
  },
  {
    title: '9. Governing Law',
    content: `These Terms shall be governed by and construed in accordance with the laws of the Province of Quebec and the federal laws of Canada applicable therein, without regard to conflict of law principles. You agree to submit to the exclusive jurisdiction of the courts located in Montreal, Quebec, Canada for the resolution of any disputes arising out of or relating to these Terms or your use of the Site.

Any claim or cause of action arising out of or related to your use of the Site or these Terms must be filed within one (1) year after such claim or cause of action arose, or it shall be forever barred.`,
  },
  {
    title: '10. Contact Information',
    content: `If you have any questions, concerns, or feedback regarding these Terms & Conditions, please do not hesitate to reach out to us.`,
    hasContactInfo: true,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      {/* Breadcrumbs */}
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Terms & Conditions' }]} />
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
              Terms & Conditions
            </motion.h1>
            <motion.p
              className="mt-4 text-sm tracking-widest text-neutral-500 uppercase"
              variants={fadeUp}
            >
              Last updated: March 2026
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-16">
          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.h2
                className="font-display text-2xl font-light tracking-tight text-neutral-900"
                variants={fadeUp}
              >
                {section.title}
              </motion.h2>
              <motion.div className="mt-2 h-px w-10 bg-brand-500" variants={fadeUp} />
              <motion.div
                className="mt-6 space-y-4 text-base leading-relaxed text-neutral-600"
                variants={fadeUp}
              >
                {section.content.split('\n\n').map((paragraph, pIndex) => (
                  <p key={pIndex}>{paragraph}</p>
                ))}
                {section.hasReturnLink && (
                  <p>
                    <Link
                      to="/return-policy"
                      className="inline-flex items-center text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                    >
                      View our Return Policy
                    </Link>
                  </p>
                )}
                {section.hasContactInfo && (
                  <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                    <p className="font-medium text-neutral-900">BLE$$ P</p>
                    <p className="mt-2 text-neutral-600">
                      Email:{' '}
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
              Have questions about our terms?
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link
                to="/contact"
                className="mt-4 inline-flex items-center text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                Contact Us
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
