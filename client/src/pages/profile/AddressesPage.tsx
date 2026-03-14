import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Star, X, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import type { Address } from '@/lib/types';

interface AddressForm {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

const emptyForm: AddressForm = {
  firstName: '',
  lastName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'CA',
  isDefault: false,
};

const countries = [
  { code: 'CA', label: 'Canada' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'FR', label: 'France' },
];

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchAddresses = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Address[]>('/addresses');
      setAddresses(data);
    } catch {
      setAddresses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (addr: Address) => {
    setForm({
      firstName: addr.firstName,
      lastName: addr.lastName,
      phone: addr.phone || '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 || '',
      city: addr.city,
      province: addr.province || '',
      postalCode: addr.postalCode,
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setEditingId(addr.id);
    setShowForm(true);
    setError('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        addressLine2: form.addressLine2 || undefined,
        phone: form.phone || undefined,
        province: form.province || undefined,
      };
      if (editingId) {
        await api.patch(`/addresses/${editingId}`, payload);
      } else {
        await api.post('/addresses', payload);
      }
      await fetchAddresses();
      closeForm();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Failed to save address.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/addresses/${id}`);
      await fetchAddresses();
      setDeleteConfirm(null);
    } catch {
      // Silently handle
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/addresses/${id}`, { isDefault: true });
      await fetchAddresses();
    } catch {
      // Silently handle
    }
  };

  const inputClass =
    'block w-full border border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors';

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6">
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Account', href: '/profile' },
                { label: 'Addresses' },
              ]}
            />
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
                Addresses
              </h1>
              <div className="mt-2 h-px w-12 bg-brand-500" />
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 bg-neutral-900 px-5 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {/* Address form modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeForm}
              >
                <motion.div
                  className="w-full max-w-lg bg-white p-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl font-light text-neutral-900">
                      {editingId ? 'Edit Address' : 'New Address'}
                    </h2>
                    <button
                      onClick={closeForm}
                      className="text-neutral-400 hover:text-neutral-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    {error && (
                      <p className="text-xs text-red-600">{error}</p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          First Name
                        </label>
                        <input
                          required
                          value={form.firstName}
                          onChange={(e) =>
                            setForm({ ...form, firstName: e.target.value })
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
                          value={form.lastName}
                          onChange={(e) =>
                            setForm({ ...form, lastName: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        Address Line 1
                      </label>
                      <input
                        required
                        value={form.addressLine1}
                        onChange={(e) =>
                          setForm({ ...form, addressLine1: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        Address Line 2
                      </label>
                      <input
                        value={form.addressLine2}
                        onChange={(e) =>
                          setForm({ ...form, addressLine2: e.target.value })
                        }
                        className={cn(inputClass, 'mt-2')}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          City
                        </label>
                        <input
                          required
                          value={form.city}
                          onChange={(e) =>
                            setForm({ ...form, city: e.target.value })
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
                          value={form.postalCode}
                          onChange={(e) =>
                            setForm({ ...form, postalCode: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          Province / State
                        </label>
                        <input
                          value={form.province}
                          onChange={(e) =>
                            setForm({ ...form, province: e.target.value })
                          }
                          className={cn(inputClass, 'mt-2')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        Country
                      </label>
                      <select
                        value={form.country}
                        onChange={(e) =>
                          setForm({ ...form, country: e.target.value })
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
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.isDefault}
                        onChange={(e) =>
                          setForm({ ...form, isDefault: e.target.checked })
                        }
                        className="h-4 w-4 border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700">
                        Set as default address
                      </span>
                    </label>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="flex-1 bg-neutral-900 px-6 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Address'}
                      </button>
                      <button
                        type="button"
                        onClick={closeForm}
                        className="px-6 py-3 text-xs font-medium tracking-widest text-neutral-600 uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Addresses list */}
          {isLoading ? (
            <div className="mt-10 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse border border-neutral-100 p-6"
                >
                  <div className="h-4 w-1/3 bg-neutral-100" />
                  <div className="mt-3 h-3 w-2/3 bg-neutral-100" />
                </div>
              ))}
            </div>
          ) : addresses.length === 0 ? (
            <motion.div
              className="mt-16 flex flex-col items-center py-12 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-50">
                <MapPin className="h-8 w-8 text-neutral-300" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 font-display text-lg font-medium text-neutral-900">
                No saved addresses
              </h3>
              <p className="mt-2 max-w-sm text-sm text-neutral-500">
                Add a shipping address to speed up your checkout experience.
              </p>
              <button
                onClick={openNew}
                className="mt-6 bg-neutral-900 px-8 py-3 text-sm font-medium tracking-widest text-white uppercase transition-all duration-300 hover:bg-[#c8a97e] hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a97e] focus-visible:ring-offset-2"
              >
                Add Address
              </button>
            </motion.div>
          ) : (
            <div className="mt-10 space-y-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="border border-neutral-100 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900">
                          {addr.firstName} {addr.lastName}
                        </p>
                        {addr.isDefault && (
                          <span className="flex items-center gap-1 text-2xs font-medium text-brand-600 uppercase">
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">
                        {addr.addressLine1}
                        {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {addr.city}{addr.province ? `, ${addr.province}` : ''} {addr.postalCode},{' '}
                        {addr.country}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!addr.isDefault && (
                        <button
                          onClick={() => handleSetDefault(addr.id)}
                          className="text-xs text-neutral-500 transition-colors hover:text-neutral-900"
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(addr)}
                        className="text-neutral-400 transition-colors hover:text-neutral-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {deleteConfirm === addr.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(addr.id)}
                            className="text-xs font-medium text-red-600"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs text-neutral-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(addr.id)}
                          className="text-neutral-400 transition-colors hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
