import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Tag, X, MapPin, Package, Mail } from 'lucide-react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import { stripePromise, isStripeConfigured } from '@/lib/stripe';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useAuth } from '@/context/AuthContext';
import type { Address, CartItem, CouponValidation } from '@/lib/types';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

const stripeAppearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#171717',
    colorBackground: '#ffffff',
    colorText: '#171717',
    colorDanger: '#dc2626',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeBase: '14px',
    borderRadius: '0px',
  },
  rules: {
    '.Input': {
      border: '1px solid #e5e5e5',
      boxShadow: 'none',
      padding: '12px 16px',
    },
    '.Input:focus': {
      border: '1px solid #171717',
      boxShadow: 'none',
    },
    '.Label': {
      fontWeight: '500',
      fontSize: '11px',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: '#737373',
    },
  },
};

const stepKeys = ['checkout.steps.shipping', 'checkout.steps.payment', 'checkout.steps.confirmation'];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

interface ShippingForm {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
}

const emptyShipping: ShippingForm = {
  firstName: '',
  lastName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  province: '',
  country: 'CA',
};

type ShippingRate = { country: string; feeCents: number; freeThresholdCents: number | null };
type CommerceConfig = { currency: 'CAD'; shippingRates: ShippingRate[]; payments?: { paypal: boolean } };

interface PaymentStepProps {
  shipping: ShippingForm;
  orderNumber: string;
  clientSecret: string;
  isProcessing: boolean;
  error: string;
  onPaymentSuccess: () => void;
  onError: (msg: string) => void;
  onProcessingChange: (val: boolean) => void;
  goBack: () => void;
}

function PaymentStepInner({
  shipping,
  isProcessing,
  error,
  onPaymentSuccess,
  onError,
  onProcessingChange,
  goBack,
}: Omit<PaymentStepProps, 'clientSecret' | 'orderNumber'>) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const handlePayment = async () => {
    if (!stripe || !elements) {
      onError(t('checkout.paymentLoading'));
      return;
    }

    onProcessingChange(true);
    onError('');

    try {
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout`,
        payment_method_data: {
          billing_details: {
            name: `${shipping.firstName} ${shipping.lastName}`,
          },
        },
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      onError(stripeError.message || t('checkout.paymentError'));
      onProcessingChange(false);
      return;
    }

    onPaymentSuccess();
    } catch {
      onError(t('checkout.paymentError'));
      onProcessingChange(false);
    }
  };

  return (
    <>
      <div className="mt-8 border border-neutral-100 p-6">
        <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
          {t('checkout.shippingTo')}
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          {shipping.firstName} {shipping.lastName}
          <br />
          {shipping.addressLine1}
          {shipping.addressLine2 ? `, ${shipping.addressLine2}` : ''}
          <br />
          {shipping.city}, {shipping.province} {shipping.postalCode}
        </p>
        <button
          onClick={goBack}
          disabled={isProcessing}
          className="mt-3 text-xs font-medium text-brand-700 underline underline-offset-2"
        >
          {t('common.edit')}
        </button>
      </div>

      <div className="mt-8">
        <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
          {t('checkout.steps.payment')}
        </p>
        <div className="mt-3">
          <PaymentElement
            options={{
              layout: 'tabs',
              wallets: { applePay: 'auto', googlePay: 'auto' },
            }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {t('checkout.cardSecure')}
        </p>
      </div>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <button
          onClick={goBack}
          disabled={isProcessing}
          className="flex-1 border border-neutral-200 px-8 py-4 text-sm font-medium tracking-widest text-neutral-700 uppercase transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          {t('common.back')}
        </button>
        <button
          onClick={handlePayment}
          disabled={isProcessing || !stripe || !elements}
          className="flex-1 bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {isProcessing ? t('checkout.processing') : t('checkout.placeOrder')}
        </button>
      </div>
    </>
  );
}

function PaymentStep({
  clientSecret,
  ...props
}: PaymentStepProps) {
  if (!clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: stripeAppearance,
      }}
    >
      <PaymentStepInner {...props} />
    </Elements>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { items, total, clearCart, refreshCart, isLoading: cartLoading } = useCart();
  const { formatPrice } = useCurrency();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  const [restored] = useState(() => {
    try {
      const raw = sessionStorage.getItem('blessp_checkout_pending');
      const data = raw ? JSON.parse(raw) : null;
      return data && Date.now() - data.savedAt < 30 * 60000 ? data : null;
    } catch { return null; }
  });
  const [currentStep, setCurrentStep] = useState(restored?.clientSecret || restored?.provider === 'paypal' ? 1 : 0);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal'>(restored?.provider === 'paypal' ? 'paypal' : 'stripe');
  const [paypalAvailable, setPaypalAvailable] = useState(false);
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState('');
  const [direction, setDirection] = useState(1);
  const [shipping, setShipping] = useState<ShippingForm>(restored?.shipping ?? emptyShipping);
  const [billing, setBilling] = useState<ShippingForm>(emptyShipping);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [guestEmail, setGuestEmail] = useState(restored?.guestEmail ?? '');
  const [orderNumber, setOrderNumber] = useState(restored?.orderNumber ?? '');
  const [orderId, setOrderId] = useState(restored?.orderId ?? '');
  const [clientSecret, setClientSecret] = useState(restored?.clientSecret ?? '');
  // Server-computed figures from the created order; authoritative over the
  // local estimate once the order exists
  const [orderShippingCents, setOrderShippingCents] = useState<number | null>(restored?.shippingCents ?? null);
  const [orderTotalCents, setOrderTotalCents] = useState<number | null>(restored?.total ?? null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [error, setError] = useState('');
  const [rates, setRates] = useState<ShippingRate[] | null>(null);
  const [ratesError, setRatesError] = useState(false);
  const [ratesAttempt, setRatesAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setRatesError(false); setRates(null);
    api.get<CommerceConfig>('/commerce/config', { signal: controller.signal })
      .then(config => {
        if (config.currency !== 'CAD' || !Array.isArray(config.shippingRates) || !config.shippingRates.length || config.shippingRates.length > 250 || config.shippingRates.some(rate => !/^[A-Z]{2}$/.test(rate.country) || !Number.isSafeInteger(rate.feeCents) || rate.feeCents < 0 || (rate.freeThresholdCents !== null && (!Number.isSafeInteger(rate.freeThresholdCents) || rate.freeThresholdCents < 0))) || new Set(config.shippingRates.map(rate => rate.country)).size !== config.shippingRates.length) throw new Error('Invalid delivery configuration');
        if (!controller.signal.aborted) { setRates(config.shippingRates); setPaypalAvailable(config.payments?.paypal === true); }
      })
      .catch(() => { if (!controller.signal.aborted) setRatesError(true); });
    return () => controller.abort();
  }, [ratesAttempt]);
  const shippingRate = rates?.find(rate => rate.country === shipping.country);
  const countryCodes = rates?.map(rate => rate.country) ?? [];
  const billingCountryCodes = [...new Set(['CA', 'US', 'GB', 'FR', billing.country, ...countryCodes])];

  // Snapshot of the order at confirmation time, captured before the cart is cleared
  const [confirmedItems, setConfirmedItems] = useState<CartItem[]>([]);
  const [confirmedSubtotal, setConfirmedSubtotal] = useState(0);
  const [confirmedShipping, setConfirmedShipping] = useState(0);
  const [confirmedDiscount, setConfirmedDiscount] = useState(0);
  const [confirmedTotal, setConfirmedTotal] = useState(0);

  // Coupon state
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);

  // Estimate uses the public server configuration; a created order keeps its own totals.
  const discountCents = appliedCoupon?.discountCents ?? 0;
  const estimatedShippingCents = shippingRate ? (shippingRate.freeThresholdCents !== null && total - discountCents >= shippingRate.freeThresholdCents ? 0 : shippingRate.feeCents) : 0;
  const pricingKnown = orderShippingCents !== null || !!shippingRate;
  const estimatedTotal = total + estimatedShippingCents - discountCents;
  const shippingCents = orderShippingCents ?? estimatedShippingCents;
  const grandTotal = orderTotalCents ?? estimatedTotal;

  useEffect(() => {
    if (isAuthenticated) {
      api
        .get<Address[]>('/addresses')
        .then((data) => setSavedAddresses(data))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  // Restore payment after a full reload or provider redirect. Confirmation is
  // based on the API payment state, never solely on URL parameters.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const secret = params.get('payment_intent_client_secret') ?? restored?.clientSecret;
    if (!restored || authLoading || (!secret && restored.provider !== 'paypal')) return;
    if ((restored.userId ?? null) !== (user?.id ?? null)) {
      sessionStorage.removeItem('blessp_checkout_pending'); sessionStorage.removeItem('blessp_checkout_attempt');
      navigate('/shop', { replace: true }); return;
    }
    let cancelled = false;
    void (async () => {
      if (restored.provider === 'paypal') {
        if (params.get('paypal') === 'cancel') {
          window.history.replaceState({}, '', '/checkout');
          setError(t('checkout.paypalCancelled')); return;
        }
        if (params.get('paypal') === 'return') {
          setIsProcessing(true);
          try {
            await api.post('/payments/paypal/capture', { orderId: restored.orderId, ...(!isAuthenticated ? { email: restored.guestEmail } : {}) });
          } finally { if (!cancelled) setIsProcessing(false); }
        }
        // Ignore URL token/PayerID as proof. The server owns the provider binding.
        window.history.replaceState({}, '', '/checkout');
        const data = isAuthenticated
          ? await api.get<{ paymentStatus: string }>(`/orders/${restored.orderId}`)
          : await api.post<{ paymentStatus: string }>('/orders/guest/lookup', { orderNumber: restored.orderNumber, email: restored.guestEmail });
        if (cancelled) return;
        if (['paid', 'partially_refunded', 'refunded'].includes(data.paymentStatus)) {
          setConfirmedItems(restored.items); setConfirmedSubtotal(restored.subtotal); setConfirmedShipping(restored.shippingCents); setConfirmedDiscount(restored.discount); setConfirmedTotal(restored.total);
          setCurrentStep(2); sessionStorage.removeItem('blessp_checkout_pending'); sessionStorage.removeItem('blessp_checkout_attempt');
          if (isAuthenticated) await refreshCart(); else await clearCart();
        } else setError(t('checkout.paymentPending'));
        return;
      }
      const stripe = await stripePromise;
      if (!stripe || cancelled) return;
      const { paymentIntent } = await stripe.retrievePaymentIntent(secret);
      if (cancelled) return;
      window.history.replaceState({}, '', '/checkout');
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        const data = isAuthenticated
          ? await api.get<{ paymentStatus: string }>(`/orders/${restored.orderId}`)
          : await api.post<{ paymentStatus: string }>('/orders/guest/lookup', { orderNumber: restored.orderNumber, email: restored.guestEmail });
        if (cancelled) return;
        if (['paid', 'partially_refunded', 'refunded'].includes(data.paymentStatus)) {
          setConfirmedItems(restored.items); setConfirmedSubtotal(restored.subtotal); setConfirmedShipping(restored.shippingCents); setConfirmedDiscount(restored.discount); setConfirmedTotal(restored.total);
          setCurrentStep(2); sessionStorage.removeItem('blessp_checkout_pending'); sessionStorage.removeItem('blessp_checkout_attempt');
          if (isAuthenticated) await refreshCart(); else await clearCart();
        } else setError(t('checkout.paymentPending', { defaultValue: 'Payment is being confirmed. Check your order status shortly.' }));
      }
    })().catch(() => { if (!cancelled) setError(t('checkout.paymentNotCompleted')); });
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, restored, user?.id]);

  // Preload the welcome coupon code into the promo field if the user has one
  // but has not yet applied or removed it.
  useEffect(() => {
    if (appliedCoupon || promoCode) return;
    try {
      const raw = localStorage.getItem('blessp_welcome_coupon');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { code?: string };
      if (parsed.code) {
        setPromoCode(parsed.code);
        setPromoOpen(true);
      }
    } catch {
      // ignore parse errors
    }
  }, [appliedCoupon, promoCode]);

  useEffect(() => {
    if (!authLoading && !cartLoading && items.length === 0 && currentStep === 0 && !restored) {
      // Do not navigate away if we are showing the confirmation (step 2) or
      // mid-redirect-back handling (URL has payment intent params).
      const hasPendingIntent = new URLSearchParams(window.location.search).has(
        'payment_intent_client_secret',
      );
      if (!hasPendingIntent) {
        navigate('/shop');
      }
    }
  }, [items, currentStep, navigate, authLoading, cartLoading, restored]);

  const goNext = () => {
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, stepKeys.length - 1));
  };

  const goBack = async () => {
    if (isProcessing) return;
    if (currentStep === 1 && orderId) {
      try { await api.post('/payments/cancel', { orderId, email: isAuthenticated ? undefined : guestEmail }); }
      catch (error) { setError((error as { message?: string }).message ?? t('checkout.failedPrepare')); return; }
      sessionStorage.removeItem('blessp_checkout_pending'); sessionStorage.removeItem('blessp_checkout_attempt');
      setClientSecret(''); setOrderId('');
    }
    // Leaving the payment step invalidates the created order's figures:
    // resubmitting the shipping form creates a new order with fresh totals
    if (currentStep === 1) {
      setOrderShippingCents(null);
      setOrderTotalCents(null);
    }
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleShippingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shippingRate) { setError(t('checkout.deliveryUnavailable')); return; }
    if (paymentProvider === 'paypal' ? !paypalAvailable : !isStripeConfigured) { setError(t('checkout.unavailable')); return; }
    setError('');
    setIsPreparingPayment(true);

    try {
      const billingAddr = billingSameAsShipping ? shipping : billing;
      const baseShipping: Record<string, unknown> = {
        firstName: shipping.firstName,
        lastName: shipping.lastName,
        phone: shipping.phone || undefined,
        addressLine1: shipping.addressLine1,
        addressLine2: shipping.addressLine2 || undefined,
        city: shipping.city,
        province: shipping.province || undefined,
        postalCode: shipping.postalCode,
        country: shipping.country,
      };

      const billingAddress = {
        firstName: billingAddr.firstName,
        lastName: billingAddr.lastName,
        phone: billingAddr.phone || undefined,
        addressLine1: billingAddr.addressLine1,
        addressLine2: billingAddr.addressLine2 || undefined,
        city: billingAddr.city,
        province: billingAddr.province || undefined,
        postalCode: billingAddr.postalCode,
        country: billingAddr.country,
      };

      interface CreatedOrder {
        id: string;
        orderNumber: string;
        totalCents: number;
        shippingCents: number;
      }


      const payload = {
        locale: i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en',
        ...baseShipping, billingAddress, couponCode: appliedCoupon?.coupon.code,
        ...(!isAuthenticated ? { email: guestEmail.trim().toLowerCase(), items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity, size: item.size || undefined, color: item.color || undefined })) } : {}),
      };
      const fingerprint = JSON.stringify({ provider: paymentProvider, userId: user?.id ?? null, payload, cart: items.map((i) => [i.product.id, i.quantity, i.size, i.color]) });
      const previous = JSON.parse(sessionStorage.getItem('blessp_checkout_attempt') ?? 'null');
      if (previous && previous.fingerprint !== fingerprint && previous.orderId) await api.post('/payments/cancel', { orderId: previous.orderId, email: previous.email });
      const attempt = previous?.fingerprint === fingerprint ? previous : { fingerprint, key: crypto.randomUUID(), email: isAuthenticated ? undefined : guestEmail.trim().toLowerCase() };
      sessionStorage.setItem('blessp_checkout_attempt', JSON.stringify(attempt));
      const order = await api.post<CreatedOrder>(isAuthenticated ? '/orders' : '/orders/guest', { ...payload, checkoutKey: attempt.key });
      sessionStorage.setItem('blessp_checkout_attempt', JSON.stringify({ ...attempt, orderId: order.id }));
      const payment = await api.post<{ clientSecret?: string; approvalUrl?: string }>(paymentProvider === 'paypal' ? '/payments/paypal/create' : isAuthenticated ? '/payments/create-intent' : '/payments/guest-create-intent', { orderId: order.id, ...(!isAuthenticated ? { email: guestEmail.trim().toLowerCase() } : {}) });
      const clientSecretValue = payment.clientSecret ?? '';
      setPaypalApprovalUrl(payment.approvalUrl ?? '');
      setOrderId(order.id);
      setOrderNumber(order.orderNumber);
      setClientSecret(clientSecretValue);
      // From here on the payment step and confirmation display the
      // server-computed amounts, never a locally recomputed figure
      setOrderShippingCents(order.shippingCents);
      setOrderTotalCents(order.totalCents);

      // Persist snapshot so a redirect-based payment (PayPal, some wallets)
      // can restore the confirmation context when it returns.
      sessionStorage.setItem(
        'blessp_checkout_pending',
        JSON.stringify({
          userId: user?.id ?? null,
          orderNumber: order.orderNumber,
          orderId: order.id,
          clientSecret: clientSecretValue,
          provider: paymentProvider,
          shipping,
          items,
          subtotal: total,
          shippingCents: order.shippingCents,
          discount: discountCents,
          total: order.totalCents,
          guestEmail: isAuthenticated ? undefined : guestEmail,
          savedAt: Date.now(),
        }),
      );

      goNext();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      if (/cancelled|expired/i.test(apiErr.message ?? '')) {
        sessionStorage.removeItem('blessp_checkout_attempt'); sessionStorage.removeItem('blessp_checkout_pending');
      }
      setError(apiErr.message || t('checkout.failedPrepare'));
    } finally {
      setIsPreparingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        const order = isAuthenticated ? await api.get<{ paymentStatus: string }>(`/orders/${orderId}`) : await api.post<{ paymentStatus: string }>('/orders/guest/lookup', { orderNumber, email: guestEmail });
        if (['paid', 'partially_refunded', 'refunded'].includes(order.paymentStatus)) {
          setConfirmedItems([...items]); setConfirmedSubtotal(total); setConfirmedShipping(shippingCents); setConfirmedDiscount(discountCents); setConfirmedTotal(grandTotal);
          sessionStorage.removeItem('blessp_checkout_pending'); sessionStorage.removeItem('blessp_checkout_attempt');
          setCurrentStep(2);
          if (isAuthenticated) await refreshCart(); else await clearCart();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setError(t('checkout.paymentPending', { defaultValue: 'Payment is being confirmed. Check your order status shortly.' }));
    } catch { setError(t('checkout.paymentPending', { defaultValue: 'Payment is being confirmed. Check your order status shortly.' })); }
    finally { setIsProcessing(false); }
  };

  const useSavedAddress = (addr: Address) => {
    setShipping({
      firstName: addr.firstName,
      lastName: addr.lastName,
      phone: addr.phone || '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      postalCode: addr.postalCode,
      province: addr.province || '',
      country: addr.country,
    });
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;

    setPromoLoading(true);
    setPromoError('');

    try {
      const result = await api.post<CouponValidation>('/coupons/validate', {
        code: promoCode.trim(),
        orderTotalCents: total,
      });
      setAppliedCoupon(result);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setPromoError(apiErr.message || t('checkout.invalidOrExpiredCode'));
      setAppliedCoupon(null);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedCoupon(null);
    setPromoCode('');
    setPromoError('');
  };

  const inputClass =
    'block w-full border border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors';

  return (
    <>
      <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { label: t('common.home'), href: '/' },
                { label: t('common.checkout') },
              ]}
            />
          </div>
          {/* Step indicator */}
          <div className="mb-12 flex items-center justify-center gap-4">
            {stepKeys.map((stepKey, i) => (
              <div key={stepKey} className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center text-xs font-medium transition-colors',
                      i < currentStep
                        ? 'bg-neutral-900 text-white'
                        : i === currentStep
                          ? 'border-2 border-neutral-900 text-neutral-900'
                          : 'border border-neutral-200 text-neutral-500',
                    )}
                  >
                    {i < currentStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      'hidden text-xs font-medium tracking-widest uppercase sm:block',
                      i <= currentStep ? 'text-neutral-900' : 'text-neutral-500',
                    )}
                  >
                    {t(stepKey)}
                  </span>
                </div>
                {i < stepKeys.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-neutral-300" />
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
            {/* Main content */}
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait" custom={direction}>
                {currentStep === 0 && (
                  <motion.form
                    key="shipping"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    onSubmit={handleShippingSubmit}
                  >
                    <h2 className="font-display text-2xl font-light text-neutral-900">
                      {t('checkout.shippingAddress')}
                    </h2>

                    {!isAuthenticated && (
                      <div className="mt-6 space-y-4">
                        <div className="border border-neutral-100 bg-neutral-50 px-4 py-3">
                          <p className="text-xs text-neutral-600">
                            {t('checkout.guest.haveAccount')}{' '}
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/signin?redirect=${encodeURIComponent('/checkout')}`,
                                )
                              }
                              className="font-medium text-neutral-900 underline underline-offset-2 hover:text-[#80603c]"
                            >
                              {t('checkout.guest.signIn')}
                            </button>
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor="guest-email"
                            className="block text-xs font-medium tracking-widest text-neutral-500 uppercase"
                          >
                            {t('checkout.guest.emailLabel')}
                          </label>
                          <input
                            id="guest-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            placeholder="you@example.com"
                            className={cn(inputClass, 'mt-2')}
                          />
                          <p className="mt-1.5 text-[11px] text-neutral-500">
                            {t('checkout.guest.emailHelp')}
                          </p>
                        </div>
                      </div>
                    )}

                    {savedAddresses.length > 0 && (
                      <div className="mt-6">
                        <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('checkout.savedAddresses')}
                        </p>
                        <div className="mt-3 space-y-2">
                          {savedAddresses.map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => useSavedAddress(addr)}
                              className="block w-full border border-neutral-200 px-4 py-3 text-left text-sm text-neutral-700 transition-colors hover:border-neutral-400"
                            >
                              {addr.firstName} {addr.lastName}, {addr.addressLine1}, {addr.city},{' '}
                              {addr.province} {addr.postalCode}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="shipping-firstName" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.firstName')}
                        </label>
                        <input id="shipping-firstName"
                          required
                          value={shipping.firstName}
                          onChange={(e) =>
                            setShipping({ ...shipping, firstName: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                      <div>
                        <label htmlFor="shipping-lastName" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.lastName')}
                        </label>
                        <input id="shipping-lastName"
                          required
                          value={shipping.lastName}
                          onChange={(e) =>
                            setShipping({ ...shipping, lastName: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label htmlFor="shipping-phone" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.phone')}
                        </label>
                        <input id="shipping-phone"
                        type="tel"
                        value={shipping.phone}
                        onChange={(e) =>
                          setShipping({ ...shipping, phone: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      />
                    </div>

                    <div className="mt-4">
                      <label htmlFor="shipping-addressLine1" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.addressLine1')}
                        </label>
                        <input id="shipping-addressLine1"
                        required
                        value={shipping.addressLine1}
                        onChange={(e) =>
                          setShipping({ ...shipping, addressLine1: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      />
                    </div>

                    <div className="mt-4">
                      <label htmlFor="shipping-addressLine2" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.addressLine2')}
                        </label>
                        <input id="shipping-addressLine2"
                        value={shipping.addressLine2}
                        onChange={(e) =>
                          setShipping({ ...shipping, addressLine2: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                        placeholder={t('checkout.addressLine2Placeholder')}
                      />
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <label htmlFor="shipping-city" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.city')}
                        </label>
                        <input id="shipping-city"
                          required
                          value={shipping.city}
                          onChange={(e) =>
                            setShipping({ ...shipping, city: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                      <div>
                        <label htmlFor="shipping-postalCode" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.postalCode')}
                        </label>
                        <input id="shipping-postalCode"
                          required
                          value={shipping.postalCode}
                          onChange={(e) =>
                            setShipping({ ...shipping, postalCode: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                      <div>
                        <label htmlFor="shipping-province" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.provinceState')}
                        </label>
                        <input id="shipping-province"
                          required
                          value={shipping.province}
                          onChange={(e) =>
                            setShipping({ ...shipping, province: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label htmlFor="shipping-country" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.country')}
                        </label>
                        <select id="shipping-country"
                        value={shipping.country}
                        onChange={(e) =>
                          setShipping({ ...shipping, country: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      >
                        {!countryCodes.includes(shipping.country) && <option value={shipping.country}>{t('checkout.chooseDeliveryCountry')}</option>}
                        {countryCodes.map((code) => (
                          <option key={code} value={code}>
                            {t(`countries.${code}`, { defaultValue: (/^[A-Z]{2}$/.test(code) ? new Intl.DisplayNames([i18n.resolvedLanguage || 'en'], { type: 'region' }).of(code) : code) || code })}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Billing address toggle */}
                    <div className="mt-8">
                      <label className="flex cursor-pointer items-center gap-3">
                        <div
                          className={cn(
                            'flex h-5 w-5 items-center justify-center border-2 transition-colors',
                            billingSameAsShipping
                              ? 'border-[#a07a52] bg-[#a07a52]'
                              : 'border-neutral-300 bg-transparent',
                          )}
                          onClick={() => setBillingSameAsShipping(!billingSameAsShipping)}
                          role="checkbox"
                          aria-label={t('checkout.billingSameAsShipping')}
                          aria-checked={billingSameAsShipping}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              setBillingSameAsShipping(!billingSameAsShipping);
                            }
                          }}
                        >
                          {billingSameAsShipping && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-sm text-neutral-700">
                          {t('checkout.billingSameAsShipping')}
                        </span>
                      </label>
                    </div>

                    {/* Billing address form */}
                    <AnimatePresence>
                      {!billingSameAsShipping && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-8">
                            <h3 className="font-display text-lg font-light text-neutral-900">
                              {t('checkout.billingAddress')}
                            </h3>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                              <div>
                                <label htmlFor="billing-firstName" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.firstName')}
                        </label>
                        <input id="billing-firstName"
                                  required={!billingSameAsShipping}
                                  value={billing.firstName}
                                  onChange={(e) =>
                                    setBilling({ ...billing, firstName: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                              <div>
                                <label htmlFor="billing-lastName" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.lastName')}
                        </label>
                        <input id="billing-lastName"
                                  required={!billingSameAsShipping}
                                  value={billing.lastName}
                                  onChange={(e) =>
                                    setBilling({ ...billing, lastName: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <label htmlFor="billing-phone" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.phone')}
                        </label>
                        <input id="billing-phone"
                                type="tel"
                                value={billing.phone}
                                onChange={(e) =>
                                  setBilling({ ...billing, phone: e.target.value })
                                }
                                className={cn(inputClass, 'mt-2')}
                              />
                            </div>

                            <div className="mt-4">
                              <label htmlFor="billing-addressLine1" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.addressLine1')}
                        </label>
                        <input id="billing-addressLine1"
                                required={!billingSameAsShipping}
                                value={billing.addressLine1}
                                onChange={(e) =>
                                  setBilling({ ...billing, addressLine1: e.target.value })
                                }
                                className={cn(inputClass, 'mt-2')}
                              />
                            </div>

                            <div className="mt-4">
                              <label htmlFor="billing-addressLine2" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.addressLine2')}
                        </label>
                        <input id="billing-addressLine2"
                                value={billing.addressLine2}
                                onChange={(e) =>
                                  setBilling({ ...billing, addressLine2: e.target.value })
                                }
                                className={cn(inputClass, 'mt-2')}
                                placeholder={t('checkout.addressLine2Placeholder')}
                              />
                            </div>

                            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                              <div>
                                <label htmlFor="billing-city" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.city')}
                        </label>
                        <input id="billing-city"
                                  required={!billingSameAsShipping}
                                  value={billing.city}
                                  onChange={(e) =>
                                    setBilling({ ...billing, city: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                              <div>
                                <label htmlFor="billing-postalCode" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.postalCode')}
                        </label>
                        <input id="billing-postalCode"
                                  required={!billingSameAsShipping}
                                  value={billing.postalCode}
                                  onChange={(e) =>
                                    setBilling({ ...billing, postalCode: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                              <div>
                                <label htmlFor="billing-province" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                  {t('common.provinceState')}
                                </label>
                                <input id="billing-province"
                                  required={!billingSameAsShipping}
                                  value={billing.province}
                                  onChange={(e) =>
                                    setBilling({ ...billing, province: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <label htmlFor="billing-country" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.country')}
                        </label>
                        <select id="billing-country"
                                value={billing.country}
                                onChange={(e) =>
                                  setBilling({ ...billing, country: e.target.value })
                                }
                                className={cn(inputClass, 'mt-2')}
                              >
                                {billingCountryCodes.map((code) => (
                                  <option key={code} value={code}>
                                    {t(`countries.${code}`, { defaultValue: (/^[A-Z]{2}$/.test(code) ? new Intl.DisplayNames([i18n.resolvedLanguage || 'en'], { type: 'region' }).of(code) : code) || code })}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {ratesError && <p role="alert" className="mt-4 text-sm text-red-800">{t('checkout.deliveryLoadError')} <button type="button" onClick={() => setRatesAttempt(value => value + 1)} className="min-h-11 underline">{t('common.retry')}</button></p>}
                    {!rates && !ratesError && <p role="status" className="mt-4 text-sm text-neutral-600">{t('common.loading')}</p>}
                    {rates && !shippingRate && <p role="alert" className="mt-4 text-sm text-red-800">{t('checkout.deliveryUnavailable')}</p>}
                    {paypalAvailable && <fieldset className="mt-6 space-y-3">
                      <legend className="mb-3 text-sm font-medium">{t('checkout.paymentMethod')}</legend>
                      {isStripeConfigured && <label className="flex min-h-12 cursor-pointer items-center gap-3 border p-4"><input type="radio" name="paymentProvider" value="stripe" checked={paymentProvider === 'stripe'} onChange={() => setPaymentProvider('stripe')} />{t('checkout.cardsAndWallets')}</label>}
                      <label className="flex min-h-12 cursor-pointer items-center gap-3 border p-4"><input type="radio" name="paymentProvider" value="paypal" checked={paymentProvider === 'paypal'} onChange={() => setPaymentProvider('paypal')} />PayPal</label>
                    </fieldset>}
                    {!isStripeConfigured && !paypalAvailable && <p role="status" className="mt-4 text-sm text-neutral-700">{t('checkout.unavailable')}</p>}
                    {error && (
                      <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isPreparingPayment || (paymentProvider === 'paypal' ? !paypalAvailable : !isStripeConfigured) || !shippingRate}
                      className="mt-8 w-full bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {isPreparingPayment ? t('checkout.preparing') : t('checkout.continueToPayment')}
                    </button>
                  </motion.form>
                )}

                {currentStep === 1 && (
                  <motion.div
                    key="payment"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="font-display text-2xl font-light text-neutral-900">
                      {t('checkout.steps.payment')}
                    </h2>

                    {paymentProvider === 'paypal' ? <div className="mt-6 space-y-5">
                      <p className="text-sm text-neutral-700">{t('checkout.paypalInstructions')}</p>
                      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                      <button type="button" disabled={isProcessing} className="min-h-12 w-full bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-50" onClick={async () => {
                        setIsProcessing(true); setError('');
                        try {
                          // A restored order may already be approved. Capture checks its
                          // real provider state; an unapproved order must be opened first.
                          if (!paypalApprovalUrl) {
                            const data = await api.post<{ approvalUrl: string }>('/payments/paypal/create', { orderId, ...(!isAuthenticated ? { email: guestEmail } : {}) });
                            setPaypalApprovalUrl(data.approvalUrl);
                            window.location.assign(data.approvalUrl);
                          } else window.location.assign(paypalApprovalUrl);
                        } catch (error) { setError((error as Error).message || t('checkout.paymentError')); setIsProcessing(false); }
                      }}>{isProcessing ? t('checkout.processing') : t('checkout.continuePaypal')}</button>
                      <button type="button" disabled={isProcessing} className="min-h-12 w-full border px-4 py-3 disabled:opacity-50" onClick={async () => {
                        setIsProcessing(true); setError('');
                        try { await api.post('/payments/paypal/capture', { orderId, ...(!isAuthenticated ? { email: guestEmail } : {}) }); await handlePaymentSuccess(); }
                        catch (error) { setError((error as Error).message || t('checkout.paymentError')); }
                        finally { setIsProcessing(false); }
                      }}>{t('checkout.checkPayment')}</button>
                      <button type="button" disabled={isProcessing} className="min-h-12 underline disabled:opacity-50" onClick={goBack}>{t('common.back')}</button>
                    </div> : <PaymentStep
                      shipping={shipping}
                      orderNumber={orderNumber}
                      clientSecret={clientSecret}
                      isProcessing={isProcessing}
                      error={error}
                      onPaymentSuccess={handlePaymentSuccess}
                      onError={setError}
                      onProcessingChange={setIsProcessing}
                      goBack={goBack}
                    />}
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="confirmation"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    {/* Header with checkmark */}
                    <div className="py-10 text-center">
                      <motion.div
                        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 200,
                          damping: 15,
                          delay: 0.2,
                        }}
                      >
                        <Check className="h-10 w-10 text-green-700" />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <h2 className="mt-8 font-display text-3xl font-light text-neutral-900">
                          {t('checkout.orderConfirmed')}
                        </h2>
                        <p className="mt-3 text-neutral-500">
                          {t('checkout.thankYou')}
                        </p>
                        {orderNumber && (
                          <p className="mt-2 text-sm text-neutral-700">
                            {t('checkout.orderNumber')}{' '}
                            <span className="font-mono font-medium">
                              {orderNumber}
                            </span>
                          </p>
                        )}
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="space-y-6"
                    >
                      {/* Email confirmation notice */}
                      <div className="flex items-center gap-3 border border-neutral-100 bg-neutral-50 px-5 py-4">
                        <Mail className="h-5 w-5 flex-shrink-0 text-[#80603c]" />
                        <p className="text-sm text-neutral-700">
                          {t('checkout.confirmation.emailNotice', {
                            email: user?.email ?? '',
                          })}
                        </p>
                      </div>

                      {/* Items ordered */}
                      {confirmedItems.length > 0 && (
                        <div className="border border-neutral-100 p-6">
                          <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                            {t('checkout.confirmation.itemsOrdered')}
                          </h3>
                          <div className="mt-4 divide-y divide-neutral-100">
                            {confirmedItems.map((item) => (
                              <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                                <div className="h-16 w-16 flex-shrink-0 bg-neutral-50">
                                  <img
                                    src={item.product.picture}
                                    alt={item.product.name}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 text-sm">
                                  <p className="font-medium text-neutral-900">
                                    {item.product.name}
                                  </p>
                                  <p className="mt-0.5 text-neutral-500">
                                    {item.size && item.size}
                                    {item.size && item.color && ', '}
                                    {item.color && item.color}
                                  </p>
                                  <p className="mt-0.5 text-neutral-500">
                                    {t('checkout.confirmation.qty', { count: item.quantity })}
                                  </p>
                                </div>
                                <p className="text-sm font-medium text-neutral-900">
                                  {formatPrice(item.product.price * item.quantity)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shipping address and estimated delivery */}
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="border border-neutral-100 p-6">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-neutral-500" />
                            <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                              {t('checkout.confirmation.shippingAddress')}
                            </h3>
                          </div>
                          <div className="mt-4 text-sm leading-relaxed text-neutral-700">
                            <p className="font-medium">{shipping.firstName} {shipping.lastName}</p>
                            <p>{shipping.addressLine1}</p>
                            {shipping.addressLine2 && <p>{shipping.addressLine2}</p>}
                            <p>{shipping.city}, {shipping.province} {shipping.postalCode}</p>
                            <p>{t(`countries.${shipping.country}`)}</p>
                          </div>
                        </div>

                        <div className="border border-neutral-100 p-6">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-neutral-500" />
                            <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                              {t('checkout.confirmation.estimatedDelivery')}
                            </h3>
                          </div>
                          <p className="mt-4 text-sm text-neutral-700">
                            {t('checkout.confirmation.deliveryTimeframe')}
                          </p>
                        </div>
                      </div>

                      {/* Payment summary */}
                      <div className="border border-neutral-100 p-6">
                        <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                          {t('checkout.confirmation.paymentSummary')}
                        </h3>
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-500">{t('common.subtotal')}</span>
                            <span className="text-neutral-900">{formatPrice(confirmedSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-500">{t('common.shipping')}</span>
                            <span className="text-neutral-900">
                              {confirmedShipping === 0 ? t('common.free') : formatPrice(confirmedShipping)}
                            </span>
                          </div>
                          {confirmedDiscount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-green-700">{t('common.discount')}</span>
                              <span className="text-green-700">
                                -{formatPrice(confirmedDiscount)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-neutral-100 pt-2 text-sm font-medium">
                            <span className="text-neutral-900">{t('common.total')}</span>
                            <span className="text-neutral-900">{formatPrice(confirmedTotal)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-center gap-4 pt-4">
                        <button
                          onClick={() => navigate('/profile/orders')}
                          className="border border-neutral-200 px-8 py-3 text-sm font-medium tracking-widest text-neutral-700 uppercase transition-colors hover:bg-neutral-50"
                        >
                          {t('checkout.viewOrders')}
                        </button>
                        <button
                          onClick={() => navigate('/shop')}
                          className="bg-neutral-900 px-8 py-3 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
                        >
                          {t('common.continueShopping')}
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Order Summary Sidebar */}
            {currentStep < 2 && (
              <div className="lg:sticky lg:top-32 lg:self-start">
                <div className="border border-neutral-100 p-6">
                  <h3 className="text-xs font-medium tracking-widest text-neutral-900 uppercase">
                    {t('checkout.orderSummary')}
                  </h3>

                  <div className="mt-6 space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="h-16 w-16 flex-shrink-0 bg-neutral-50">
                          <img
                            src={item.product.picture}
                            alt={item.product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1 text-sm">
                          <p className="font-medium text-neutral-900">
                            {item.product.name}
                          </p>
                          <p className="text-neutral-500">
                            {item.size && `${item.size}`}
                            {item.size && item.color && ', '}
                            {item.color && item.color}
                            {' '}
                            &times; {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-neutral-900">
                          {formatPrice(item.product.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Promo Code Section */}
                  <div className="mt-6 border-t border-neutral-100 pt-4">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between rounded bg-green-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-green-700" />
                          <span className="text-sm font-medium text-green-700">
                            {appliedCoupon.coupon.code}
                          </span>
                          <span className="text-xs text-green-700">
                            ({appliedCoupon.coupon.discountType === 'percentage'
                              ? t('checkout.percentOff', { value: appliedCoupon.coupon.discountValue })
                              : t('checkout.amountOff', { value: formatPrice(appliedCoupon.coupon.discountValue) })})
                          </span>
                        </div>
                        <button
                          onClick={handleRemovePromo}
                          className="flex h-8 w-8 shrink-0 items-center justify-center text-green-700 transition-colors hover:text-green-800"
                          aria-label={t('checkout.removePromoCode')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPromoOpen(!promoOpen)}
                          className="flex items-center gap-1.5 text-xs font-medium tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-700"
                        >
                          <Tag className="h-3.5 w-3.5" />
                          {t('checkout.havePromoCode')}
                        </button>

                        {promoOpen && (
                          <div className="mt-3 flex gap-2">
                            <input
                              value={promoCode}
                              onChange={(e) => {
                                setPromoCode(e.target.value);
                                setPromoError('');
                              }}
                              placeholder={t('checkout.enterCode')}
                              className="flex-1 border border-neutral-200 bg-transparent px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-900 focus:outline-none transition-colors"
                            />
                            <button
                              type="button"
                              onClick={handleApplyPromo}
                              disabled={promoLoading || !promoCode.trim()}
                              className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {promoLoading ? '...' : t('common.apply')}
                            </button>
                          </div>
                        )}

                        {promoError && (
                          <p className="mt-2 text-xs text-red-600">{promoError}</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">{t('common.subtotal')}</span>
                      <span className="text-neutral-900">{formatPrice(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">{t('common.shipping')}</span>
                      <span className="text-neutral-900">
                        {!pricingKnown ? '—' : shippingCents === 0 ? t('common.free') : formatPrice(shippingCents)}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-neutral-500">
                      {t('checkout.disclosures.deliveryEstimate')}
                    </p>
                    {appliedCoupon && discountCents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">{t('common.discount')}</span>
                        <span className="text-green-700">
                          -{formatPrice(discountCents)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-neutral-100 pt-2 text-sm font-medium">
                      <span className="text-neutral-900">{t('common.total')}</span>
                      <span className="text-neutral-900">
                        {pricingKnown ? formatPrice(grandTotal) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Pre-contract disclosures: charge currency, cross-border duties
                      and the fact that the total above is the amount payable. Sales
                      tax is not itemised here; it is handled once the tax provider is
                      integrated. */}
                  <div className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 text-[11px] leading-relaxed text-neutral-500">
                    <p>{t('checkout.disclosures.currency')}</p>
                    <p>{t('checkout.disclosures.customs')}</p>
                    <p>{t('checkout.disclosures.finalAmount')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
