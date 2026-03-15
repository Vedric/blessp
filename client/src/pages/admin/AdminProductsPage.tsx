import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, cn } from '@/lib/utils';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import type { Product, PaginatedResponse } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function AdminProductsPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteModal, setDeleteModal] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getRaw<PaginatedResponse<Product>>(
        `/admin/products?page=${page}&perPage=20&includeInactive=true`,
      );
      setProducts(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleActive = async (product: Product) => {
    try {
      await api.patch(`/admin/products/${product.id}`, {
        isActive: !product.isActive,
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, isActive: !p.isActive } : p,
        ),
      );
    } catch {
      // Silently handle
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/products/${deleteModal.id}`);
      setProducts((prev) => prev.filter((p) => p.id !== deleteModal.id));
      setDeleteModal(null);
    } catch {
      // Silently handle
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
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
                { label: t('admin.products.title') },
              ]}
            />
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
                {t('admin.products.title')}
              </h1>
              <div className="mt-2 h-px w-12 bg-brand-500" />
            </div>
            <Link
              to="/admin/products/new"
              className="flex items-center gap-1.5 bg-neutral-900 px-5 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('admin.products.addProduct')}
            </Link>
          </div>

          {/* Delete confirmation modal */}
          <AnimatePresence>
            {deleteModal && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteModal(null)}
              >
                <motion.div
                  className="w-full max-w-sm bg-white p-8 text-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-medium text-neutral-900">
                    {t('admin.products.deleteProduct')}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    {t('admin.products.deleteConfirm', { name: deleteModal.name })}
                  </p>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setDeleteModal(null)}
                      className="flex-1 border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {isDeleting ? t('admin.products.deleting') : t('common.delete')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Products list */}
          {isLoading ? (
            <div className="mt-10 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse border border-neutral-100 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-neutral-100" />
                    <div className="flex-1">
                      <div className="h-4 w-1/3 bg-neutral-100" />
                      <div className="mt-2 h-3 w-1/5 bg-neutral-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="mt-20 text-center">
              <p className="text-neutral-500">{t('admin.products.noProducts')}</p>
            </div>
          ) : (
            <div className="mt-10 space-y-2">
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    'flex items-center gap-4 border border-neutral-100 p-4 transition-colors',
                    !product.isActive && 'opacity-60',
                  )}
                >
                  <div className="h-16 w-16 flex-shrink-0 bg-neutral-50">
                    {product.picture && (
                      <img
                        src={product.picture}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {product.name}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-sm text-neutral-500">
                      <span>{formatPrice(product.price)}</span>
                      <span className="text-neutral-300">|</span>
                      <span>{product.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(product)}
                      className={cn(
                        'p-2 transition-colors',
                        product.isActive
                          ? 'text-green-600 hover:text-green-800'
                          : 'text-neutral-400 hover:text-neutral-600',
                      )}
                      title={product.isActive ? t('admin.products.deactivate') : t('admin.products.activate')}
                    >
                      {product.isActive ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <Link
                      to={`/admin/products/${product.id}/edit`}
                      className="p-2 text-neutral-400 transition-colors hover:text-neutral-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => setDeleteModal(product)}
                      className="p-2 text-neutral-400 transition-colors hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center text-sm transition-colors',
                    page === i + 1
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
