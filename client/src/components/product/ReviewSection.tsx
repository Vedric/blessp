import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { StarRating } from '@/components/common/StarRating';
import { formatDate, cn } from '@/lib/utils';
import type { Review, ReviewSummary, PaginatedResponse } from '@/lib/types';

interface ReviewSectionProps {
  productId: string;
}

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export function ReviewSection({ productId }: ReviewSectionProps) {
  const { user, isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [userReview, setUserReview] = useState<Review | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.get<ReviewSummary>(`/reviews/summary/${productId}`);
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [productId]);

  const fetchReviews = useCallback(async (pageNum: number) => {
    try {
      const res = await api.getRaw<PaginatedResponse<Review>>(
        `/reviews?productId=${productId}&page=${pageNum}&perPage=10`,
      );
      if (pageNum === 1) {
        setReviews(res.data);
      } else {
        setReviews((prev) => [...prev, ...res.data]);
      }
      setTotalPages(res.pagination.totalPages);
    } catch {
      if (pageNum === 1) setReviews([]);
    }
  }, [productId]);

  // Find the current user's review from the loaded reviews
  useEffect(() => {
    if (user && reviews.length > 0) {
      const found = reviews.find((r) => r.userId === user.id);
      setUserReview(found || null);
    } else {
      setUserReview(null);
    }
  }, [reviews, user]);

  useEffect(() => {
    setIsLoading(true);
    setPage(1);
    Promise.all([fetchSummary(), fetchReviews(1)]).finally(() => setIsLoading(false));
  }, [fetchSummary, fetchReviews]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReviews(nextPage);
  };

  const openCreateForm = () => {
    setFormRating(0);
    setFormTitle('');
    setFormComment('');
    setFormError('');
    setIsEditing(false);
    setShowForm(true);
  };

  const openEditForm = () => {
    if (!userReview) return;
    setFormRating(userReview.rating);
    setFormTitle(userReview.title || '');
    setFormComment(userReview.comment || '');
    setFormError('');
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formRating < 1 || formRating > 5) {
      setFormError('Please select a rating.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && userReview) {
        const updated = await api.patch<Review>(`/reviews/${userReview.id}`, {
          rating: formRating,
          title: formTitle || undefined,
          comment: formComment || undefined,
        });
        setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await api.post<Review>('/reviews', {
          productId,
          rating: formRating,
          title: formTitle || undefined,
          comment: formComment || undefined,
        });
        setReviews((prev) => [created, ...prev]);
      }

      setShowForm(false);
      await fetchSummary();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setFormError(error?.message || 'Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userReview) return;

    try {
      await api.delete(`/reviews/${userReview.id}`);
      setReviews((prev) => prev.filter((r) => r.id !== userReview.id));
      setUserReview(null);
      await fetchSummary();
    } catch {
      // Silently handle deletion errors
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <section className="mt-24 border-t border-neutral-100 pt-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-neutral-100" />
          <div className="h-32 w-full bg-neutral-100" />
        </div>
      </section>
    );
  }

  return (
    <motion.section
      className="mt-24 border-t border-neutral-100 pt-16"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={staggerContainer}
    >
      <motion.h2
        className="font-display text-2xl font-light tracking-tight text-neutral-900 md:text-3xl"
        variants={fadeSlideUp}
      >
        Customer Reviews
      </motion.h2>
      <motion.div className="mt-2 h-px w-12 bg-[#c8a97e]" variants={fadeSlideUp} />

      {/* Summary */}
      {summary && (
        <motion.div
          className="mt-10 grid gap-8 md:grid-cols-[auto_1fr_auto]"
          variants={fadeSlideUp}
        >
          {/* Average rating */}
          <div className="flex flex-col items-center">
            <span className="text-5xl font-light text-neutral-900">
              {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '0'}
            </span>
            <StarRating rating={summary.averageRating} size={18} className="mt-2" />
            <span className="mt-1 text-sm text-neutral-500">
              {summary.totalReviews} {summary.totalReviews === 1 ? 'review' : 'reviews'}
            </span>
          </div>

          {/* Distribution bars */}
          <div className="flex flex-col justify-center gap-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star] || 0;
              const percentage =
                summary.totalReviews > 0
                  ? (count / summary.totalReviews) * 100
                  : 0;

              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="w-6 text-right text-sm text-neutral-500">{star}</span>
                  <Star size={12} className="shrink-0 fill-[#c8a97e] text-[#c8a97e]" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <motion.div
                      className="h-full rounded-full bg-[#c8a97e]"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-neutral-400">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Write a Review button */}
          <div className="flex flex-col items-center justify-center">
            {isAuthenticated && !userReview && (
              <button
                onClick={openCreateForm}
                className="border border-neutral-900 px-6 py-3 text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:bg-neutral-900 hover:text-white"
              >
                Write a Review
              </button>
            )}
            {isAuthenticated && userReview && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={openEditForm}
                  className="border border-neutral-900 px-6 py-3 text-sm font-medium tracking-widest text-neutral-900 uppercase transition-colors hover:bg-neutral-900 hover:text-white"
                >
                  Edit Review
                </button>
                <button
                  onClick={handleDelete}
                  className="px-6 py-2 text-xs font-medium tracking-wider text-neutral-400 uppercase transition-colors hover:text-red-500"
                >
                  Delete Review
                </button>
              </div>
            )}
            {!isAuthenticated && (
              <p className="text-sm text-neutral-400">
                Sign in to leave a review.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Review Form (modal overlay) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              className="relative mx-4 w-full max-w-lg bg-white p-8 shadow-xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowForm(false)}
                className="absolute right-4 top-4 text-neutral-400 transition-colors hover:text-neutral-900"
              >
                <X size={20} />
              </button>

              <h3 className="font-display text-xl font-light tracking-tight text-neutral-900">
                {isEditing ? 'Edit Your Review' : 'Write a Review'}
              </h3>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {/* Rating */}
                <div>
                  <label className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                    Rating
                  </label>
                  <StarRating
                    rating={formRating}
                    size={28}
                    interactive
                    onChange={setFormRating}
                    className="mt-2"
                  />
                </div>

                {/* Title */}
                <div>
                  <label
                    htmlFor="review-title"
                    className="text-xs font-medium tracking-widest text-neutral-500 uppercase"
                  >
                    Title (optional)
                  </label>
                  <input
                    id="review-title"
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    maxLength={200}
                    className="mt-2 w-full border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-[#c8a97e]"
                    placeholder="Summarize your experience"
                  />
                </div>

                {/* Comment */}
                <div>
                  <label
                    htmlFor="review-comment"
                    className="text-xs font-medium tracking-widest text-neutral-500 uppercase"
                  >
                    Comment (optional)
                  </label>
                  <textarea
                    id="review-comment"
                    value={formComment}
                    onChange={(e) => setFormComment(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    className="mt-2 w-full resize-none border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-[#c8a97e]"
                    placeholder="Share your thoughts about this product"
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-500">{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || formRating === 0}
                  className={cn(
                    'w-full py-4 text-sm font-medium tracking-widest uppercase transition-all',
                    formRating > 0
                      ? 'bg-neutral-900 text-white hover:bg-[#c8a97e] hover:text-neutral-950'
                      : 'cursor-not-allowed bg-neutral-200 text-neutral-400',
                  )}
                >
                  {isSubmitting
                    ? 'Submitting...'
                    : isEditing
                      ? 'Update Review'
                      : 'Submit Review'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review List */}
      <motion.div className="mt-12 space-y-8" variants={staggerContainer}>
        {reviews.length === 0 && (
          <motion.p
            className="py-8 text-center text-sm text-neutral-400"
            variants={fadeSlideUp}
          >
            No reviews yet. Be the first to share your thoughts.
          </motion.p>
        )}

        {reviews.map((review) => (
          <motion.div
            key={review.id}
            className="border-b border-neutral-50 pb-8"
            variants={fadeSlideUp}
          >
            <div className="flex items-start gap-4">
              {/* User initials avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-medium text-neutral-600">
                {getInitials(review.user.firstName, review.user.lastName)}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-900">
                    {review.user.firstName} {review.user.lastName}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {formatDate(review.createdAt)}
                  </span>
                </div>

                <StarRating rating={review.rating} size={14} className="mt-1" />

                {review.title && (
                  <p className="mt-2 text-sm font-semibold text-neutral-900">
                    {review.title}
                  </p>
                )}

                {review.comment && (
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    {review.comment}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Load More */}
      {page < totalPages && (
        <motion.div className="mt-8 flex justify-center" variants={fadeSlideUp}>
          <button
            onClick={handleLoadMore}
            className="border border-neutral-200 px-8 py-3 text-sm font-medium tracking-widest text-neutral-600 uppercase transition-colors hover:border-neutral-900 hover:text-neutral-900"
          >
            Load More Reviews
          </button>
        </motion.div>
      )}
    </motion.section>
  );
}

