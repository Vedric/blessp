import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Plus, Trash2, ChevronLeft, Star, Loader2, X } from 'lucide-react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import { stripePromise, isStripeConfigured } from '@/lib/stripe';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

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

function CardBrandBadge({ brand }: { brand: string }) {
  const brandMap: Record<string, { label: string; color: string }> = {
    visa: { label: 'VISA', color: 'bg-blue-600 text-white' },
    mastercard: { label: 'MC', color: 'bg-red-600 text-white' },
    amex: { label: 'AMEX', color: 'bg-blue-800 text-white' },
    discover: { label: 'DISC', color: 'bg-orange-500 text-white' },
  };

  const info = brandMap[brand.toLowerCase()] || { label: brand.toUpperCase(), color: 'bg-neutral-600 text-white' };

  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold tracking-wider', info.color)}>
      {info.label}
    </span>
  );
}

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function AddPaymentMethodFormInner({ onSuccess, onCancel }: AddPaymentMethodFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setIsSaving(true);
    setError('');

    try {
      const { error: stripeError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/profile/payment-methods`,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        setError(stripeError.message || t('paymentMethods.addCardError'));
        setIsSaving(false);
        return;
      }

      onSuccess();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || t('paymentMethods.addCardError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      className="overflow-hidden"
    >
      <div className="border border-neutral-200 p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
            {t('paymentMethods.newCard')}
          </p>
          <button
            onClick={onCancel}
            aria-label={t('common.close')}
            className="text-neutral-500 transition-colors hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-600">{error}</p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSaving || !stripe}
            className="flex items-center gap-2 bg-neutral-900 px-6 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            {t('paymentMethods.saveCard')}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-xs font-medium tracking-widest text-neutral-600 uppercase"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AddPaymentMethodForm({ onSuccess, onCancel }: AddPaymentMethodFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .post<{ clientSecret: string }>('/payments/setup-intent', {})
      .then((data) => setClientSecret(data.clientSecret))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (!clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: stripeAppearance }}
    >
      <AddPaymentMethodFormInner onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

export default function PaymentMethodsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(Boolean(deleteConfirmId), dialogRef, () => { if (!actionLoading) setDeleteConfirmId(null); });

  const fetchMethods = async () => {
    try {
      const data = await api.get<PaymentMethod[]>('/payments/methods');
      setMethods(data);
    } catch {
      setError(t('paymentMethods.fetchError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/payments/methods/${id}/default`);
      await fetchMethods();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || t('paymentMethods.defaultError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await api.delete(`/payments/methods/${id}`);
      setDeleteConfirmId(null);
      await fetchMethods();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || t('paymentMethods.deleteError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSuccess = () => {
    setShowAddForm(false);
    fetchMethods();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <button
            onClick={() => navigate('/profile')}
            className="mb-6 flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('paymentMethods.backToProfile')}
          </button>

          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('paymentMethods.title')}
          </h1>
          <div className="mt-2 h-px w-12 bg-brand-500" />

          {error && (
            <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {methods.length === 0 && !showAddForm ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-12 flex flex-col items-center py-16 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-50">
                <CreditCard className="h-10 w-10 text-neutral-300" />
              </div>
              <h3 className="mt-6 font-display text-xl font-light text-neutral-900">
                {t('paymentMethods.emptyTitle')}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-neutral-500">
                {t('paymentMethods.emptyDescription')}
              </p>
              <button
                disabled={!isStripeConfigured}
                onClick={() => setShowAddForm(true)}
                className="mt-8 flex items-center gap-2 bg-neutral-900 px-8 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4" />
                {t('paymentMethods.addCard')}
              </button>
            </motion.div>
          ) : (
            <>
              <div className="mt-8 space-y-3">
                {methods.map((method) => (
                  <motion.div
                    key={method.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-between border border-neutral-100 p-5"
                  >
                    <div className="flex items-center gap-4">
                      <CreditCard className="h-5 w-5 text-neutral-500" />
                      <CardBrandBadge brand={method.brand} />
                      <div>
                        <span className="text-sm font-medium text-neutral-900">
                          {t('paymentMethods.cardEnding')} {method.last4}
                        </span>
                        <span className="ml-3 text-xs text-neutral-500">
                          {String(method.expMonth).padStart(2, '0')}/{method.expYear}
                        </span>
                      </div>
                      {method.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-widest text-[#80603c] uppercase">
                          <Star className="h-3 w-3 fill-[#a07a52]" />
                          {t('paymentMethods.default')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!method.isDefault && (
                        <button
                          onClick={() => handleSetDefault(method.id)}
                          disabled={actionLoading === method.id}
                          className="px-3 py-1.5 text-xs font-medium tracking-widest text-neutral-600 uppercase transition-colors hover:text-neutral-900 disabled:opacity-50"
                        >
                          {actionLoading === method.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t('paymentMethods.setDefault')
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirmId(method.id)}
                        disabled={actionLoading === method.id}
                        className="p-1.5 text-neutral-500 transition-colors hover:text-red-500 disabled:opacity-50"
                        aria-label={t('paymentMethods.remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6">
                <AnimatePresence>
                  {showAddForm ? (
                    <AddPaymentMethodForm
                      onSuccess={handleAddSuccess}
                      onCancel={() => setShowAddForm(false)}
                    />
                  ) : (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      disabled={!isStripeConfigured}
                onClick={() => setShowAddForm(true)}
                      className="flex items-center gap-2 border border-dashed border-neutral-300 px-6 py-3 text-xs font-medium tracking-widest text-neutral-600 uppercase transition-colors hover:border-neutral-500 hover:text-neutral-900"
                    >
                      <Plus className="h-4 w-4" />
                      {t('paymentMethods.addCard')}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {!isStripeConfigured && <p role="status" className="mt-4 text-sm text-neutral-600">{t('paymentMethods.unavailable')}</p>}
          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {deleteConfirmId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
                onClick={() => setDeleteConfirmId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2 }}
                  ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-payment-title" tabIndex={-1}
              className="max-h-[90vh] overflow-y-auto w-full max-w-sm bg-white p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 id="delete-payment-title" className="font-display text-lg font-medium text-neutral-900">
                    {t('paymentMethods.removeTitle')}
                  </h3>
                  <p className="mt-3 text-sm text-neutral-600">
                    {t('paymentMethods.removeConfirm')}
                  </p>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => handleDelete(deleteConfirmId)}
                      disabled={actionLoading === deleteConfirmId}
                      className="flex items-center gap-2 bg-red-600 px-6 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading === deleteConfirmId && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {t('paymentMethods.remove')}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-6 py-2.5 text-xs font-medium tracking-widest text-neutral-600 uppercase"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
