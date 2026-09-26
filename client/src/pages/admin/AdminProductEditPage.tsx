import { ProductImage } from '@/components/common/ProductImage';
import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import type { Product } from '@/lib/types';

const allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const allColors = ['Black', 'White', 'Blue', 'Pink', 'Gray', 'Navy'];
const allCategories = ['hoodies', 'pants', 'sets', 'accessories'];

interface ProductForm {
  name: string;
  description: string;
  details: string;
  price: number;
  category: string;
  picture: string;
  images: string[];
  sizes: string[];
  colors: string[];
  isActive: boolean;
}

const emptyForm: ProductForm = {
  name: '',
  description: '',
  details: '',
  price: 0,
  category: 'hoodies',
  picture: '',
  images: [],
  sizes: [],
  colors: [],
  isActive: true,
};

export default function AdminProductEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const originalStocks = useRef<Record<string, number>>({});
  const savedProductId = useRef<string | undefined>(id);
  const saving = useRef(false);
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [imageInput, setImageInput] = useState('');
  const [priceDisplay, setPriceDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    savedProductId.current = isNew ? undefined : id;
    originalStocks.current = {};
    setStocks({}); setIsLoading(!isNew); setError('');
    if (isNew) { setForm(emptyForm); setPriceDisplay(''); return; }
    const fetchProduct = async () => {
      try {
        const data = await api.get<Product>(`/admin/products/${id}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setForm({
          name: data.name,
          description: data.description,
          details: data.details || '',
          price: data.price,
          category: data.category,
          picture: data.picture || '',
          images: data.images,
          sizes: data.sizes,
          colors: data.colors,
          isActive: data.isActive,
        });
        setPriceDisplay((data.price / 100).toFixed(2));
        const variants = await api.get<Array<{ size: string; color: string; stock: number }>>(`/admin/products/${id}/variants`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        originalStocks.current = Object.fromEntries(variants.map((v) => [JSON.stringify([v.size, v.color]), v.stock]));
        setStocks(originalStocks.current);
      } catch {
        if (!controller.signal.aborted) navigate('/admin/products');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchProduct();
    return () => controller.abort();
  }, [id, isNew, navigate]);

  const toggleArrayItem = (
    key: 'sizes' | 'colors',
    item: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(item)
        ? prev[key].filter((v) => v !== item)
        : [...prev[key], item],
    }));
  };

  const addImage = () => {
    const trimmed = imageInput.trim();
    if (trimmed && !form.images.includes(trimmed)) {
      setForm((prev) => ({ ...prev, images: [...prev.images, trimmed] }));
      setImageInput('');
    }
  };

  const removeImage = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  const handlePriceChange = (val: string) => {
    setPriceDisplay(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setForm((prev) => ({ ...prev, price: Math.round(parsed * 100) }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setError('');
    setIsSaving(true);
    try {
      const payload = { ...form, picture: form.picture || undefined };
      const product = savedProductId.current ? await api.patch<Product>(`/admin/products/${savedProductId.current}`, payload) : await api.post<Product>('/admin/products', payload);
      savedProductId.current = product.id;
      const variants = (form.sizes.length ? form.sizes : ['']).flatMap((size) => (form.colors.length ? form.colors : ['']).map((color) => ({ size, color, stock: stocks[JSON.stringify([size, color])] ?? 0, expectedStock: originalStocks.current[JSON.stringify([size, color])] })));
      const changed = variants.filter(variant => variant.expectedStock === undefined || variant.stock !== variant.expectedStock);
      if (changed.length) await api.put(`/admin/products/${product.id}/variants`, { variants: changed });
      navigate('/admin/products');
    } catch (err: unknown) {
      const apiErr = err as { message?: string; code?: string };
      setError(apiErr.code === 'CONFLICT' ? t('inventory.editorConflict') : apiErr.message || t('admin.productEdit.failedSave'));
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  const inputClass =
    'block w-full border border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-900 focus:outline-none focus:ring-0 transition-colors';

  if (isLoading) {
    return (
      <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/3 bg-neutral-100" />
            <div className="h-12 w-full bg-neutral-100" />
            <div className="h-32 w-full bg-neutral-100" />
          </div>
        </div>
      </div>
    );
  }

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
                { label: t('common.home'), href: '/' },
                { label: t('nav.admin'), href: '/admin' },
                { label: t('admin.products.title'), href: '/admin/products' },
                { label: isNew ? t('admin.productEdit.newProduct') : t('admin.productEdit.editProduct') },
              ]}
            />
          </div>

          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {isNew ? t('admin.productEdit.newProduct') : t('admin.productEdit.editProduct')}
          </h1>
          <div className="mt-2 h-px w-12 bg-brand-500" />

          <Link to="/admin/inventory" className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4">{t('inventory.title')}</Link>
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {error && (
              <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                {savedProductId.current && <Link to="/admin/inventory" className="mt-3 block underline">{t('inventory.title')}</Link>}
              </div>
            )}

            <fieldset className="border p-4"><legend>{t('admin.productEdit.stock', { defaultValue: 'Available stock by variant' })}</legend>
              {(form.sizes.length ? form.sizes : ['']).flatMap((size) => (form.colors.length ? form.colors : ['']).map((color) => { const key = JSON.stringify([size, color]); return <label key={key} className="mt-3 flex items-center justify-between gap-4"><span>{size || '—'} / {color || '—'}</span><input aria-label={`Stock ${size} ${color}`} type="number" min="0" max="1000000" step="1" required className="w-24 border p-2" value={stocks[key] ?? 0} onChange={(e) => setStocks((prev) => ({ ...prev, [key]: Number(e.target.value) }))} /></label>; }))}
            </fieldset>
            {/* Name */}
            <div>
              <label htmlFor="field-name" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('admin.productEdit.productName')}
                        </label>
                        <input id="field-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={cn(inputClass, 'mt-2')}
                placeholder={t('admin.productEdit.productNamePlaceholder')}
              />
            </div>

            {/* Price */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="field-price" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('admin.productEdit.price')}
                        </label>
                        <input id="field-price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={priceDisplay}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className={cn(inputClass, 'mt-2')}
                  placeholder={t('admin.productEdit.pricePlaceholder')}
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="field-category" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('admin.productEdit.category')}
                        </label>
                        <select id="field-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={cn(inputClass, 'mt-2')}
              >
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="field-description" className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                          {t('admin.productEdit.description')}
                        </label>
                        <textarea id="field-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={4}
                className={cn(inputClass, 'mt-2 resize-y')}
                placeholder={t('admin.productEdit.descriptionPlaceholder')}
              />
            </div>

            {/* Sizes */}
            <div>
              <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t('admin.productEdit.sizes')}
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {allSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleArrayItem('sizes', size)}
                    className={cn(
                      'flex h-10 min-w-[3rem] items-center justify-center border px-3 text-sm font-medium transition-colors',
                      form.sizes.includes(size)
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-400',
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div>
              <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t('admin.productEdit.colors')}
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {allColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => toggleArrayItem('colors', color)}
                    className={cn(
                      'flex items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors',
                      form.colors.includes(color)
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-400',
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="block text-xs font-medium tracking-widest text-neutral-500 uppercase">
                {t('admin.productEdit.images')}
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  className={cn(inputClass, 'flex-1')}
                  placeholder={t('admin.productEdit.imageUrlPlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addImage();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addImage}
                  className="bg-neutral-900 px-4 py-3 text-sm text-white transition-colors hover:bg-neutral-800"
                >
                  {t('common.add')}
                </button>
              </div>
              {form.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.images.map((img, i) => (
                    <div
                      key={i}
                      className="group relative h-20 w-20 bg-neutral-50"
                    >
                      <ProductImage compact
                        src={img}
                        alt={`Product image ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`${t('common.delete')} ${t('admin.productEdit.images')} ${i + 1}`}
                        onClick={() => removeImage(i)}
                        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center bg-red-600 text-white transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="h-4 w-4 border-neutral-300"
              />
              <span className="text-sm text-neutral-700">
                {t('admin.productEdit.activeVisible')}
              </span>
            </label>

            {/* Actions */}
            <div className="flex flex-col gap-4 border-t border-neutral-100 pt-8 sm:flex-row">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-neutral-900 px-8 py-3 text-sm font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {isSaving
                  ? t('common.saving')
                  : isNew
                    ? t('admin.productEdit.createProduct')
                    : t('admin.productEdit.saveChanges')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/products')}
                className="px-8 py-3 text-sm font-medium tracking-widest text-neutral-600 uppercase transition-colors hover:text-neutral-900"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
