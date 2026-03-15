import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Tag, X, CreditCard, MapPin, Package, Mail } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useAuth } from '@/context/AuthContext';
import type { Address, CartItem, CouponValidation } from '@/lib/types';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

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

const countryCodes = ['CA', 'US', 'GB', 'FR'];

const cardStyle = {
  style: {
    base: {
      fontSize: '14px',
      color: '#171717',
      '::placeholder': { color: '#a3a3a3' },
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    invalid: { color: '#dc2626' },
  },
};

function CardBrandIcon({ brand }: { brand: string }) {
  const brandMap: Record<string, { label: string; color: string }> = {
    visa: { label: 'VISA', color: 'bg-blue-600 text-white' },
    mastercard: { label: 'MC', color: 'bg-red-600 text-white' },
    amex: { label: 'AMEX', color: 'bg-blue-800 text-white' },
    discover: { label: 'DISC', color: 'bg-orange-500 text-white' },
  };

  const info = brandMap[brand.toLowerCase()] || { label: brand.toUpperCase(), color: 'bg-neutral-600 text-white' };

  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider', info.color)}>
      {info.label}
    </span>
  );
}

interface PaymentStepProps {
  shipping: ShippingForm;
  orderNumber: string;
  clientSecret: string;
  isProcessing: boolean;
  error: string;
  savedMethods: SavedPaymentMethod[];
  onPaymentSuccess: () => void;
  onError: (msg: string) => void;
  onProcessingChange: (val: boolean) => void;
  goBack: () => void;
}

function PaymentStep({
  shipping,
  clientSecret,
  isProcessing,
  error,
  savedMethods,
  onPaymentSuccess,
  onError,
  onProcessingChange,
  goBack,
}: PaymentStepProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const [selectedMethod, setSelectedMethod] = useState<string>(
    savedMethods.length > 0
      ? (savedMethods.find((m) => m.isDefault)?.id ?? savedMethods[0].id)
      : 'new',
  );
  const [saveNewCard, setSaveNewCard] = useState(false);

  const handlePayment = async () => {
    if (!stripe) {
      onError(t('checkout.paymentLoading'));
      return;
    }

    onProcessingChange(true);
    onError('');

    if (selectedMethod !== 'new') {
      // Pay with a saved payment method
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: selectedMethod },
      );

      if (stripeError) {
        onError(stripeError.message || t('checkout.paymentError'));
        onProcessingChange(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        onPaymentSuccess();
      } else {
        onError(t('checkout.paymentNotCompleted'));
        onProcessingChange(false);
      }
      return;
    }

    // Pay with a new card
    if (!elements) {
      onError(t('checkout.paymentLoading'));
      onProcessingChange(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError(t('checkout.cardFormError'));
      onProcessingChange(false);
      return;
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${shipping.firstName} ${shipping.lastName}`,
          },
        },
      },
    );

    if (stripeError) {
      onError(stripeError.message || t('checkout.paymentError'));
      onProcessingChange(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      // Save the card if requested
      if (saveNewCard && paymentIntent.payment_method) {
        try {
          await api.post('/payments/methods', {
            paymentMethodId: paymentIntent.payment_method,
          });
        } catch {
          // Non-critical: card save failure should not block order confirmation
        }
      }
      onPaymentSuccess();
    } else {
      onError(t('checkout.paymentNotCompleted'));
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
          className="mt-3 text-xs font-medium text-brand-600 underline underline-offset-2"
        >
          {t('common.edit')}
        </button>
      </div>

      {/* Saved Payment Methods */}
      {savedMethods.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
            {t('checkout.savedCards')}
          </p>
          <div className="mt-3 space-y-2">
            {savedMethods.map((method) => (
              <label
                key={method.id}
                className={cn(
                  'flex cursor-pointer items-center gap-4 border px-4 py-3 transition-colors',
                  selectedMethod === method.id
                    ? 'border-neutral-900 bg-neutral-50'
                    : 'border-neutral-200 hover:border-neutral-400',
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={selectedMethod === method.id}
                  onChange={() => setSelectedMethod(method.id)}
                  className="sr-only"
                />
                <div className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                  selectedMethod === method.id ? 'border-neutral-900' : 'border-neutral-300',
                )}>
                  {selectedMethod === method.id && (
                    <div className="h-2 w-2 rounded-full bg-neutral-900" />
                  )}
                </div>
                <CardBrandIcon brand={method.brand} />
                <span className="text-sm text-neutral-900">
                  {t('checkout.cardEnding')} {method.last4}
                </span>
                <span className="text-xs text-neutral-500">
                  {String(method.expMonth).padStart(2, '0')}/{method.expYear}
                </span>
                {method.isDefault && (
                  <span className="ml-auto text-[10px] font-medium tracking-widest text-[#c8a97e] uppercase">
                    {t('checkout.default')}
                  </span>
                )}
              </label>
            ))}

            {/* New card option */}
            <label
              className={cn(
                'flex cursor-pointer items-center gap-4 border px-4 py-3 transition-colors',
                selectedMethod === 'new'
                  ? 'border-neutral-900 bg-neutral-50'
                  : 'border-neutral-200 hover:border-neutral-400',
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="new"
                checked={selectedMethod === 'new'}
                onChange={() => setSelectedMethod('new')}
                className="sr-only"
              />
              <div className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                selectedMethod === 'new' ? 'border-neutral-900' : 'border-neutral-300',
              )}>
                {selectedMethod === 'new' && (
                  <div className="h-2 w-2 rounded-full bg-neutral-900" />
                )}
              </div>
              <CreditCard className="h-4 w-4 text-neutral-500" />
              <span className="text-sm text-neutral-900">
                {t('checkout.useNewCard')}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Card Element (only when using a new card) */}
      <AnimatePresence>
        {selectedMethod === 'new' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-8">
              <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t('checkout.cardDetails')}
              </p>
              <div className="mt-3 border border-neutral-200 bg-white px-4 py-4">
                <CardElement options={cardStyle} />
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                {t('checkout.cardSecure')}
              </p>

              {/* Save card checkbox */}
              <label className="mt-4 flex cursor-pointer items-center gap-3">
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center border-2 transition-colors',
                    saveNewCard
                      ? 'border-[#c8a97e] bg-[#c8a97e]'
                      : 'border-neutral-300 bg-transparent',
                  )}
                  onClick={() => setSaveNewCard(!saveNewCard)}
                  role="checkbox"
                  aria-checked={saveNewCard}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSaveNewCard(!saveNewCard);
                    }
                  }}
                >
                  {saveNewCard && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm text-neutral-700">
                  {t('checkout.saveCardForFuture')}
                </span>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          disabled={isProcessing || !stripe}
          className="flex-1 bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {isProcessing ? t('checkout.processing') : t('checkout.placeOrder')}
        </button>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, total, clearCart } = useCart();
  const { formatPrice } = useCurrency();
  const { isAuthenticated, user } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [shipping, setShipping] = useState<ShippingForm>(emptyShipping);
  const [billing, setBilling] = useState<ShippingForm>(emptyShipping);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [error, setError] = useState('');

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

  const shippingCents = total > 10000 ? 0 : 995;
  const discountCents = appliedCoupon?.discountCents ?? 0;
  const grandTotal = total + shippingCents - discountCents;

  useEffect(() => {
    if (isAuthenticated) {
      api
        .get<Address[]>('/addresses')
        .then((data) => setSavedAddresses(data))
        .catch(() => {});
      api
        .get<SavedPaymentMethod[]>('/payments/methods')
        .then((data) => setSavedPaymentMethods(data))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (items.length === 0 && currentStep < 2) {
      navigate('/shop');
    }
  }, [items, currentStep, navigate]);

  const goNext = () => {
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, stepKeys.length - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleShippingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsPreparingPayment(true);

    try {
      const billingAddr = billingSameAsShipping ? shipping : billing;
      const orderPayload: Record<string, unknown> = {
        firstName: shipping.firstName,
        lastName: shipping.lastName,
        phone: shipping.phone || undefined,
        addressLine1: shipping.addressLine1,
        addressLine2: shipping.addressLine2 || undefined,
        city: shipping.city,
        province: shipping.province || undefined,
        postalCode: shipping.postalCode,
        country: shipping.country,
        billingAddress: {
          firstName: billingAddr.firstName,
          lastName: billingAddr.lastName,
          phone: billingAddr.phone || undefined,
          addressLine1: billingAddr.addressLine1,
          addressLine2: billingAddr.addressLine2 || undefined,
          city: billingAddr.city,
          province: billingAddr.province || undefined,
          postalCode: billingAddr.postalCode,
          country: billingAddr.country,
        },
      };

      if (appliedCoupon) {
        orderPayload.couponCode = appliedCoupon.coupon.code;
      }

      const order = await api.post<{ id: string }>('/orders', orderPayload);

      setOrderNumber(order.id);

      const payment = await api.post<{ clientSecret: string }>('/payments/create-intent', {
        orderId: order.id,
      });

      setClientSecret(payment.clientSecret);
      goNext();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || t('checkout.failedPrepare'));
    } finally {
      setIsPreparingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Capture the order snapshot before clearing so the confirmation step can display it
    setConfirmedItems([...items]);
    setConfirmedSubtotal(total);
    setConfirmedShipping(shippingCents);
    setConfirmedDiscount(discountCents);
    setConfirmedTotal(grandTotal);

    clearCart();
    goNext();
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
    'block w-full border border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors';

  return (
    <Elements stripe={stripePromise}>
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
                          : 'border border-neutral-200 text-neutral-400',
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
                      i <= currentStep ? 'text-neutral-900' : 'text-neutral-400',
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
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.firstName')}
                        </label>
                        <input
                          required
                          value={shipping.firstName}
                          onChange={(e) =>
                            setShipping({ ...shipping, firstName: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.lastName')}
                        </label>
                        <input
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
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        {t('common.phone')}
                      </label>
                      <input
                        type="tel"
                        value={shipping.phone}
                        onChange={(e) =>
                          setShipping({ ...shipping, phone: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        {t('common.addressLine1')}
                      </label>
                      <input
                        required
                        value={shipping.addressLine1}
                        onChange={(e) =>
                          setShipping({ ...shipping, addressLine1: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        {t('common.addressLine2')}
                      </label>
                      <input
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
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.city')}
                        </label>
                        <input
                          required
                          value={shipping.city}
                          onChange={(e) =>
                            setShipping({ ...shipping, city: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.postalCode')}
                        </label>
                        <input
                          required
                          value={shipping.postalCode}
                          onChange={(e) =>
                            setShipping({ ...shipping, postalCode: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('common.provinceState')}
                        </label>
                        <input
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
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        {t('common.country')}
                      </label>
                      <select
                        value={shipping.country}
                        onChange={(e) =>
                          setShipping({ ...shipping, country: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      >
                        {countryCodes.map((code) => (
                          <option key={code} value={code}>
                            {t(`countries.${code}`)}
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
                              ? 'border-[#c8a97e] bg-[#c8a97e]'
                              : 'border-neutral-300 bg-transparent',
                          )}
                          onClick={() => setBillingSameAsShipping(!billingSameAsShipping)}
                          role="checkbox"
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
                                <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                  {t('common.firstName')}
                                </label>
                                <input
                                  required={!billingSameAsShipping}
                                  value={billing.firstName}
                                  onChange={(e) =>
                                    setBilling({ ...billing, firstName: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                  {t('common.lastName')}
                                </label>
                                <input
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
                              <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                {t('common.phone')}
                              </label>
                              <input
                                type="tel"
                                value={billing.phone}
                                onChange={(e) =>
                                  setBilling({ ...billing, phone: e.target.value })
                                }
                                className={cn(inputClass, 'mt-2')}
                              />
                            </div>

                            <div className="mt-4">
                              <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                {t('common.addressLine1')}
                              </label>
                              <input
                                required={!billingSameAsShipping}
                                value={billing.addressLine1}
                                onChange={(e) =>
                                  setBilling({ ...billing, addressLine1: e.target.value })
                                }
                                className={cn(inputClass, 'mt-2')}
                              />
                            </div>

                            <div className="mt-4">
                              <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                {t('common.addressLine2')}
                              </label>
                              <input
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
                                <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                  {t('common.city')}
                                </label>
                                <input
                                  required={!billingSameAsShipping}
                                  value={billing.city}
                                  onChange={(e) =>
                                    setBilling({ ...billing, city: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                  {t('common.postalCode')}
                                </label>
                                <input
                                  required={!billingSameAsShipping}
                                  value={billing.postalCode}
                                  onChange={(e) =>
                                    setBilling({ ...billing, postalCode: e.target.value })
                                  }
                                  className={cn(inputClass, 'mt-2')}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                  Province / State
                                </label>
                                <input
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
                              <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                                {t('common.country')}
                              </label>
                              <select
                                value={billing.country}
                                onChange={(e) =>
                                  setBilling({ ...billing, country: e.target.value })
                                }
                                className={cn(inputClass, 'mt-2')}
                              >
                                {countryCodes.map((code) => (
                                  <option key={code} value={code}>
                                    {t(`countries.${code}`)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {error && (
                      <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isPreparingPayment}
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

                    <PaymentStep
                      shipping={shipping}
                      orderNumber={orderNumber}
                      clientSecret={clientSecret}
                      isProcessing={isProcessing}
                      error={error}
                      savedMethods={savedPaymentMethods}
                      onPaymentSuccess={handlePaymentSuccess}
                      onError={setError}
                      onProcessingChange={setIsProcessing}
                      goBack={goBack}
                    />
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
                        <Check className="h-10 w-10 text-green-600" />
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
                              {orderNumber.slice(0, 8).toUpperCase()}
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
                        <Mail className="h-5 w-5 flex-shrink-0 text-[#c8a97e]" />
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
                            <MapPin className="h-4 w-4 text-neutral-400" />
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
                            <Package className="h-4 w-4 text-neutral-400" />
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
                              <span className="text-green-600">{t('common.discount')}</span>
                              <span className="text-green-600">
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
                          <Tag className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">
                            {appliedCoupon.coupon.code}
                          </span>
                          <span className="text-xs text-green-600">
                            ({appliedCoupon.coupon.discountType === 'percentage'
                              ? t('checkout.percentOff', { value: appliedCoupon.coupon.discountValue })
                              : t('checkout.amountOff', { value: formatPrice(appliedCoupon.coupon.discountValue) })})
                          </span>
                        </div>
                        <button
                          onClick={handleRemovePromo}
                          className="text-green-600 transition-colors hover:text-green-800"
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
                              className="flex-1 border border-neutral-200 bg-transparent px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition-colors"
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
                        {shippingCents === 0 ? t('common.free') : formatPrice(shippingCents)}
                      </span>
                    </div>
                    {appliedCoupon && discountCents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">{t('common.discount')}</span>
                        <span className="text-green-600">
                          -{formatPrice(discountCents)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-neutral-100 pt-2 text-sm font-medium">
                      <span className="text-neutral-900">{t('common.total')}</span>
                      <span className="text-neutral-900">
                        {formatPrice(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Elements>
  );
}
