import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Tag, X } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useAuth } from '@/context/AuthContext';
import type { Address, CouponValidation } from '@/lib/types';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';

const steps = ['Shipping', 'Payment', 'Confirmation'];

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

const countries = [
  { code: 'CA', label: 'Canada' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'FR', label: 'France' },
];

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

function PaymentStep({
  shipping,
  clientSecret,
  isProcessing,
  error,
  onPaymentSuccess,
  onError,
  onProcessingChange,
  goBack,
}: PaymentStepProps) {
  const stripe = useStripe();
  const elements = useElements();

  const handlePayment = async () => {
    if (!stripe || !elements) {
      onError('Payment system is still loading. Please wait a moment.');
      return;
    }

    onProcessingChange(true);
    onError('');

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('Unable to load the card form. Please refresh and try again.');
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
      onError(stripeError.message || 'Payment failed. Please try again.');
      onProcessingChange(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onPaymentSuccess();
    } else {
      onError('Payment was not completed. Please try again.');
      onProcessingChange(false);
    }
  };

  return (
    <>
      <div className="mt-8 border border-neutral-100 p-6">
        <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
          Shipping to
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
          Edit
        </button>
      </div>

      <div className="mt-8">
        <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
          Card Details
        </p>
        <div className="mt-3 border border-neutral-200 bg-white px-4 py-4">
          <CardElement options={cardStyle} />
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Your payment is processed securely via Stripe.
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
          Back
        </button>
        <button
          onClick={handlePayment}
          disabled={isProcessing || !stripe}
          className="flex-1 bg-neutral-900 px-8 py-4 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Place Order'}
        </button>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();
  const { formatPrice } = useCurrency();
  const { isAuthenticated } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [shipping, setShipping] = useState<ShippingForm>(emptyShipping);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [error, setError] = useState('');

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
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (items.length === 0 && currentStep < 2) {
      navigate('/shop');
    }
  }, [items, currentStep, navigate]);

  const goNext = () => {
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
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
      setError(apiErr.message || 'Failed to prepare payment. Please try again.');
    } finally {
      setIsPreparingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
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
      setPromoError(apiErr.message || 'Invalid or expired code');
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
                { label: 'Home', href: '/' },
                { label: 'Checkout' },
              ]}
            />
          </div>
          {/* Step indicator */}
          <div className="mb-12 flex items-center justify-center gap-4">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-4">
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
                    {step}
                  </span>
                </div>
                {i < steps.length - 1 && (
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
                      Shipping Address
                    </h2>

                    {savedAddresses.length > 0 && (
                      <div className="mt-6">
                        <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          Saved Addresses
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
                          First Name
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
                          Last Name
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
                        Phone
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
                        Address Line 1
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
                        Address Line 2
                      </label>
                      <input
                        value={shipping.addressLine2}
                        onChange={(e) =>
                          setShipping({ ...shipping, addressLine2: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                        placeholder="Apartment, suite, etc. (optional)"
                      />
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          City
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
                          Postal Code
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
                          Province / State
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
                        Country
                      </label>
                      <select
                        value={shipping.country}
                        onChange={(e) =>
                          setShipping({ ...shipping, country: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      >
                        {countries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

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
                      {isPreparingPayment ? 'Preparing...' : 'Continue to Payment'}
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
                      Payment
                    </h2>

                    <PaymentStep
                      shipping={shipping}
                      orderNumber={orderNumber}
                      clientSecret={clientSecret}
                      isProcessing={isProcessing}
                      error={error}
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
                    className="py-12 text-center"
                  >
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
                        Order Confirmed
                      </h2>
                      <p className="mt-3 text-neutral-500">
                        Thank you for your purchase.
                      </p>
                      {orderNumber && (
                        <p className="mt-2 text-sm text-neutral-700">
                          Order number:{' '}
                          <span className="font-mono font-medium">
                            {orderNumber.slice(0, 8).toUpperCase()}
                          </span>
                        </p>
                      )}
                      <div className="mt-10 flex justify-center gap-4">
                        <button
                          onClick={() => navigate('/profile/orders')}
                          className="border border-neutral-200 px-8 py-3 text-sm font-medium tracking-widest text-neutral-700 uppercase transition-colors hover:bg-neutral-50"
                        >
                          View Orders
                        </button>
                        <button
                          onClick={() => navigate('/shop')}
                          className="bg-neutral-900 px-8 py-3 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
                        >
                          Continue Shopping
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
                    Order Summary
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
                              ? `${appliedCoupon.coupon.discountValue}% off`
                              : `${formatPrice(appliedCoupon.coupon.discountValue)} off`})
                          </span>
                        </div>
                        <button
                          onClick={handleRemovePromo}
                          className="text-green-600 transition-colors hover:text-green-800"
                          aria-label="Remove promo code"
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
                          Have a promo code?
                        </button>

                        {promoOpen && (
                          <div className="mt-3 flex gap-2">
                            <input
                              value={promoCode}
                              onChange={(e) => {
                                setPromoCode(e.target.value);
                                setPromoError('');
                              }}
                              placeholder="Enter code"
                              className="flex-1 border border-neutral-200 bg-transparent px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition-colors"
                            />
                            <button
                              type="button"
                              onClick={handleApplyPromo}
                              disabled={promoLoading || !promoCode.trim()}
                              className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {promoLoading ? '...' : 'Apply'}
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
                      <span className="text-neutral-500">Subtotal</span>
                      <span className="text-neutral-900">{formatPrice(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">Shipping</span>
                      <span className="text-neutral-900">
                        {shippingCents === 0 ? 'Free' : formatPrice(shippingCents)}
                      </span>
                    </div>
                    {appliedCoupon && discountCents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Discount</span>
                        <span className="text-green-600">
                          -{formatPrice(discountCents)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-neutral-100 pt-2 text-sm font-medium">
                      <span className="text-neutral-900">Total</span>
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
