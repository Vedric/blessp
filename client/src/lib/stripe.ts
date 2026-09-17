import { loadStripe, type Stripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey && import.meta.env.PROD) {
  console.error(
    'VITE_STRIPE_PUBLISHABLE_KEY is not set. Payment features will be disabled.',
  );
}

export const stripePromise: Promise<Stripe | null> = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null);

export const isStripeConfigured = Boolean(stripePublishableKey);
