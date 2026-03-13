import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Star, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { PaginatedResponse } from '@/lib/types';

/* ── Types ── */

interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  user: { firstName: string; lastName: string };
  product: { id: string; name: string; picture: string | null };
}

/* ── Animation variants ── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ── Helpers ── */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < rating
              ? 'fill-[#c8a97e] text-[#c8a97e]'
              : 'text-neutral-200',
          )}
        />
      ))}
    </div>
  );
}

const ratingOptions = [
  { label: 'All Ratings', value: '' },
  { label: '5 Stars', value: '5' },
  { label: '4 Stars', value: '4' },
  { label: '3 Stars', value: '3' },
  { label: '2 Stars', value: '2' },
  { label: '1 Star', value: '1' },
];

/* ── Component ── */

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [ratingFilter, setRatingFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '20');
      if (ratingFilter) params.set('rating', ratingFilter);

      const res = await api.getRaw<PaginatedResponse<AdminReview>>(
        `/reviews/admin/all?${params.toString()}`,
      );
      setReviews(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.totalItems);
    } catch {
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, ratingFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await api.delete(`/reviews/admin/${deleteTarget.id}`);
      setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setTotalItems((prev) => prev - 1);
      setDeleteTarget(null);
    } catch {
      // Allow the modal to remain open so the user can retry
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
          <Link
            to="/admin"
            className="mb-6 inline-flex items-center gap-1 text-xs font-medium tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
                Reviews
              </h1>
              <div className="mt-2 h-px w-12 bg-[#c8a97e]" />
            </div>
            {!isLoading && (
              <p className="text-xs text-neutral-400">
                {totalItems} review{totalItems !== 1 ? 's' : ''} total
              </p>
            )}
          </div>

          {/* Rating filter */}
          <div className="mt-8 flex flex-wrap gap-2">
            {ratingOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setRatingFilter(opt.value);
                  setPage(1);
                }}
                className={cn(
                  'px-4 py-2 text-xs font-medium tracking-widest uppercase transition-colors',
                  ratingFilter === opt.value
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Reviews table */}
          {isLoading ? (
            <div className="mt-8 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse border border-neutral-100 p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-4 w-32 bg-neutral-100" />
                    <div className="h-4 w-20 bg-neutral-100" />
                    <div className="flex-1" />
                    <div className="h-4 w-24 bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="mt-20 text-center">
              <Star className="mx-auto h-8 w-8 text-neutral-200" />
              <p className="mt-3 text-neutral-500">No reviews found.</p>
            </div>
          ) : (
            <motion.div
              className="mt-8"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-2xs font-medium tracking-widest text-neutral-400 uppercase">
                      <th className="pb-3">Product</th>
                      <th className="pb-3">Customer</th>
                      <th className="pb-3">Rating</th>
                      <th className="pb-3">Comment</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((review) => (
                      <tr
                        key={review.id}
                        className="border-b border-neutral-50 transition-colors hover:bg-neutral-50"
                      >
                        <td className="py-4 pr-4">
                          <span className="text-sm font-medium text-neutral-900">
                            {review.product.name}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="text-sm text-neutral-600">
                            {review.user.firstName} {review.user.lastName}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <StarRating rating={review.rating} />
                        </td>
                        <td className="max-w-xs py-4 pr-4">
                          {review.title && (
                            <p className="text-sm font-medium text-neutral-800">
                              {review.title}
                            </p>
                          )}
                          <p className="truncate text-sm text-neutral-500">
                            {review.comment ?? 'No comment'}
                          </p>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="text-xs text-neutral-400">
                            {formatDate(review.createdAt)}
                          </span>
                        </td>
                        <td className="py-4">
                          <button
                            onClick={() => setDeleteTarget(review)}
                            className="p-1.5 text-neutral-400 transition-colors hover:text-red-600"
                            title="Delete review"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border border-neutral-100 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">
                          {review.product.name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {review.user.firstName} {review.user.lastName}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteTarget(review)}
                        className="p-1 text-neutral-400 transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2">
                      <StarRating rating={review.rating} />
                    </div>
                    {review.title && (
                      <p className="mt-2 text-sm font-medium text-neutral-800">
                        {review.title}
                      </p>
                    )}
                    {review.comment && (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                        {review.comment}
                      </p>
                    )}
                    <p className="mt-2 text-2xs text-neutral-400">
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
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

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isDeleting && setDeleteTarget(null)}
          >
            <motion.div
              className="w-full max-w-md bg-white p-8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-medium text-neutral-900">
                  Delete Review
                </h3>
                <button
                  onClick={() => !isDeleting && setDeleteTarget(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Are you sure you want to delete this review by{' '}
                <span className="font-medium text-neutral-900">
                  {deleteTarget.user.firstName} {deleteTarget.user.lastName}
                </span>{' '}
                on{' '}
                <span className="font-medium text-neutral-900">
                  {deleteTarget.product.name}
                </span>
                ? This action cannot be undone.
              </p>
              <div className="mt-2">
                <StarRating rating={deleteTarget.rating} />
                {deleteTarget.comment && (
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-400 italic">
                    &ldquo;{deleteTarget.comment}&rdquo;
                  </p>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="flex-1 border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Review'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
