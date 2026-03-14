import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { RotateCcw, CheckCircle2, Clock, Package, AlertCircle } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const highlights = [
  { icon: Clock, label: '30-Day Window', description: 'From date of delivery' },
  { icon: Package, label: 'Original Condition', description: 'Unworn with tags attached' },
  { icon: RotateCcw, label: 'Free Returns', description: 'On all domestic orders' },
  { icon: CheckCircle2, label: '5\u201310 Business Days', description: 'Refund processing time' },
];

const sections = [
  {
    title: 'Overview',
    content: `At BLE$$ P, we are committed to ensuring your complete satisfaction with every purchase. We understand that sometimes an item may not meet your expectations, and we want the return process to be as seamless as possible.

This Return Policy outlines the terms and conditions for returning or exchanging products purchased through our website. Please read this policy carefully before initiating a return.`,
  },
  {
    title: 'Eligibility',
    content: `Items are eligible for return within 30 days of the delivery date. To qualify for a return, the following conditions must be met:

\u2022 The item must be unworn, unwashed, and free of any alterations.
\u2022 All original tags and labels must be attached.
\u2022 The item must be returned in its original packaging.
\u2022 Proof of purchase (order confirmation email or receipt) is required.

Items returned outside the 30-day window or that do not meet the above conditions may be refused or returned to you at your expense.`,
  },
  {
    title: 'Condition Requirements',
    content: `We inspect all returned items upon receipt. Items must be in resalable condition to qualify for a refund or exchange. This means:

\u2022 No signs of wear, including odors, stains, pet hair, or makeup marks.
\u2022 No missing buttons, zippers, or other components.
\u2022 Items must not have been tailored or altered in any way.
\u2022 Shoes must be returned in their original shoe box, which must be in its original condition.

We reserve the right to decline a return if the item does not meet these requirements.`,
  },
  {
    title: 'How to Initiate a Return',
    content: `To start a return, please follow these steps:

1. Contact our support team at returns@blessp.com or through the Contact page on our website. Include your order number and the item(s) you wish to return.

2. You will receive a Return Merchandise Authorization (RMA) number along with detailed instructions and a prepaid return shipping label (for domestic orders).

3. Pack the item(s) securely in their original packaging, attach the return label, and drop the package off at the designated carrier location.

4. Once your return is received and inspected, we will notify you by email regarding the status of your refund or exchange.

Please do not send items back without first obtaining an RMA number, as unauthorized returns may not be processed.`,
  },
  {
    title: 'Refund Process',
    content: `Approved refunds will be issued to your original payment method. Please allow 5 to 10 business days for the refund to appear on your statement after we have processed the return.

\u2022 Credit/debit card refunds may take an additional 2 to 5 business days depending on your financial institution.
\u2022 Original shipping costs are non-refundable unless the return is due to a defect or an error on our part.
\u2022 If you paid using a promotional code or gift card, the refund will be issued as store credit.

You will receive an email confirmation once your refund has been processed.`,
  },
  {
    title: 'Exchanges',
    content: `We offer exchanges for a different size or color of the same item, subject to availability. To request an exchange, please follow the same process as a return and indicate your preferred replacement item.

If the requested item is not available, we will issue a full refund to your original payment method.

Exchanges are processed within 3 to 5 business days of receiving the returned item. A new order confirmation will be sent to your email with updated tracking information.`,
  },
  {
    title: 'Non-Returnable Items',
    content: `The following items are final sale and cannot be returned or exchanged:

\u2022 Items marked as "Final Sale" or purchased during clearance promotions.
\u2022 Gift cards.
\u2022 Intimate apparel and swimwear (for hygiene reasons).
\u2022 Items that have been personalized or customized.
\u2022 Items purchased through third-party retailers (please refer to the retailer's return policy).

Please review product descriptions carefully before purchasing, as non-returnable items will be clearly indicated on the product page.`,
  },
  {
    title: 'Damaged or Defective Items',
    content: `If you receive an item that is damaged, defective, or incorrect, please contact us within 48 hours of delivery. Include your order number, a description of the issue, and photographs of the item and packaging.

We will arrange for a prepaid return label at no cost to you and, depending on your preference, provide a replacement item or a full refund, including any original shipping charges.

Quality is at the core of everything we do, and we take reports of defective items very seriously. Your feedback helps us maintain the standards our customers expect.`,
  },
  {
    title: 'Contact for Returns',
    content: `For any questions or concerns regarding returns and exchanges, our team is here to help.`,
    hasContactInfo: true,
  },
];

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen">
      {/* Breadcrumbs */}
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Return Policy' }]} />
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
              Return Policy
            </motion.h1>
            <motion.p
              className="mt-4 text-sm tracking-widest text-neutral-500 uppercase"
              variants={fadeUp}
            >
              Hassle-free returns within 30 days
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
            {highlights.map((item, index) => (
              <motion.div key={index} className="text-center" variants={fadeUp}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                  <item.icon className="h-5 w-5 text-brand-600" />
                </div>
                <p className="mt-3 text-sm font-medium text-neutral-900">{item.label}</p>
                <p className="mt-1 text-xs text-neutral-500">{item.description}</p>
              </motion.div>
            ))}
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
                {section.hasContactInfo && (
                  <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                      <div>
                        <p className="font-medium text-neutral-900">Returns Department</p>
                        <p className="mt-2 text-neutral-600">
                          Email:{' '}
                          <a
                            href="mailto:returns@blessp.com"
                            className="text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                          >
                            returns@blessp.com
                          </a>
                        </p>
                        <p className="mt-1 text-neutral-600">
                          General inquiries:{' '}
                          <a
                            href="mailto:hello@blessp.com"
                            className="text-brand-600 underline underline-offset-4 transition-colors hover:text-brand-700"
                          >
                            hello@blessp.com
                          </a>
                        </p>
                        <p className="mt-3 text-sm text-neutral-500">
                          Response time: within 24 to 48 business hours
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
              Need further assistance?
            </motion.p>
            <motion.div className="mt-4 flex items-center justify-center gap-6" variants={fadeUp}>
              <Link
                to="/contact"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                Contact Us
              </Link>
              <span className="text-neutral-300">|</span>
              <Link
                to="/terms"
                className="text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:text-brand-600"
              >
                Terms & Conditions
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
