import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star, Gift, Trophy, ArrowLeft, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import type { LoyaltyBalance, LoyaltyTransaction, LoyaltyTier, PaginatedResponse } from '@/lib/types';

const TIER_CONFIG: Record<LoyaltyTier, {
  icon: typeof Crown;
  color: string;
  bgGradient: string;
  borderColor: string;
  threshold: number;
}> = {
  Bronze: {
    icon: Star,
    color: 'text-amber-700',
    bgGradient: 'from-amber-100 to-amber-50',
    borderColor: 'border-amber-200',
    threshold: 0,
  },
  Silver: {
    icon: Trophy,
    color: 'text-neutral-500',
    bgGradient: 'from-neutral-200 to-neutral-100',
    borderColor: 'border-neutral-300',
    threshold: 500,
  },
  Gold: {
    icon: Crown,
    color: 'text-[#c8a97e]',
    bgGradient: 'from-[#c8a97e]/20 to-[#c8a97e]/5',
    borderColor: 'border-[#c8a97e]/40',
    threshold: 2000,
  },
  Platinum: {
    icon: Sparkles,
    color: 'text-violet-500',
    bgGradient: 'from-violet-100 to-violet-50',
    borderColor: 'border-violet-200',
    threshold: 5000,
  },
};

const TIER_ORDER: LoyaltyTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function LoyaltyPage() {
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [balanceData, txData] = await Promise.all([
        api.get<LoyaltyBalance>('/loyalty/balance'),
        api.getRaw<PaginatedResponse<LoyaltyTransaction>>(
          `/loyalty/transactions?page=${page}&perPage=10`,
        ),
      ]);
      setBalance(balanceData);
      setTransactions(txData.data);
      setTotalPages(txData.pagination.totalPages);
    } catch {
      // Silently handle fetch failures; the empty state will show
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleRedeem = async () => {
    if (!balance || balance.points < 100) return;

    setRedeemError('');
    setRedeemSuccess('');
    setIsRedeeming(true);

    // Redeem in multiples of 100, up to the user's available balance
    const redeemablePoints = Math.floor(balance.points / 100) * 100;

    try {
      await api.post('/loyalty/redeem', { points: redeemablePoints });
      const discountValue = ((redeemablePoints / 100) * 5).toFixed(2);
      setRedeemSuccess(
        `Successfully redeemed ${redeemablePoints} points for a $${discountValue} discount.`,
      );
      await fetchData();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setRedeemError(apiErr.message || 'Failed to redeem points.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const tierConfig = balance ? TIER_CONFIG[balance.tier] : TIER_CONFIG.Bronze;
  const TierIcon = tierConfig.icon;

  // Progress calculation
  const currentTierIndex = balance ? TIER_ORDER.indexOf(balance.tier) : 0;
  const currentThreshold = TIER_CONFIG[TIER_ORDER[currentTierIndex]].threshold;
  const nextThreshold = balance?.nextTier
    ? TIER_CONFIG[balance.nextTier].threshold
    : currentThreshold;
  const progressPercent = balance
    ? balance.nextTier
      ? Math.min(
          ((balance.points - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
          100,
        )
      : 100
    : 0;

  if (isLoading && !balance) {
    return (
      <div className="min-h-screen px-4 pt-32 pb-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse space-y-6">
            <div className="h-6 w-32 bg-neutral-100" />
            <div className="h-48 bg-neutral-100" />
            <div className="h-32 bg-neutral-100" />
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
          <Link
            to="/profile"
            className="mb-6 inline-flex items-center gap-1 text-xs font-medium tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Account
          </Link>

          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            Loyalty Rewards
          </h1>
          <div className="mt-2 h-px w-12 bg-[#c8a97e]" />

          {/* Tier Card */}
          {balance && (
            <motion.div
              className={cn(
                'mt-10 border bg-gradient-to-br p-8',
                tierConfig.bgGradient,
                tierConfig.borderColor,
              )}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ rotate: -15, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
                    >
                      <TierIcon className={cn('h-8 w-8', tierConfig.color)} />
                    </motion.div>
                    <div>
                      <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                        Your Tier
                      </p>
                      <h2 className={cn('font-display text-2xl font-light', tierConfig.color)}>
                        {balance.tier}
                      </h2>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
                    Points Balance
                  </p>
                  <motion.p
                    className="font-display text-4xl font-light text-neutral-900"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {balance.points.toLocaleString()}
                  </motion.p>
                </div>
              </div>

              {/* Progress to next tier */}
              {balance.nextTier && (
                <div className="mt-8">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{balance.tier}</span>
                    <span>
                      {balance.pointsToNextTier.toLocaleString()} points to {balance.nextTier}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden bg-white/60">
                    <motion.div
                      className="h-full bg-[#c8a97e]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-2xs text-neutral-400">
                    <span>{currentThreshold.toLocaleString()}</span>
                    <span>{nextThreshold.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {!balance.nextTier && (
                <p className="mt-6 text-sm text-neutral-600">
                  You have reached the highest tier. Enjoy exclusive Platinum benefits.
                </p>
              )}
            </motion.div>
          )}

          {/* Tier milestones */}
          <motion.div
            className="mt-6 grid grid-cols-4 gap-2"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {TIER_ORDER.map((tier) => {
              const config = TIER_CONFIG[tier];
              const TIcon = config.icon;
              const isActive = balance ? TIER_ORDER.indexOf(balance.tier) >= TIER_ORDER.indexOf(tier) : false;

              return (
                <motion.div
                  key={tier}
                  variants={fadeUp}
                  className={cn(
                    'border p-3 text-center transition-all',
                    isActive
                      ? cn('bg-gradient-to-b', config.bgGradient, config.borderColor)
                      : 'border-neutral-100 bg-neutral-50 opacity-50',
                  )}
                >
                  <TIcon className={cn('mx-auto h-4 w-4', isActive ? config.color : 'text-neutral-300')} />
                  <p className={cn('mt-1 text-xs font-medium', isActive ? 'text-neutral-900' : 'text-neutral-400')}>
                    {tier}
                  </p>
                  <p className="text-2xs text-neutral-400">
                    {config.threshold.toLocaleString()}+
                  </p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Redeem Section */}
          {balance && balance.points >= 100 && (
            <motion.div
              className="mt-6 border border-neutral-100 p-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <Gift className="h-5 w-5 text-[#c8a97e]" />
                <div>
                  <h3 className="text-sm font-medium text-neutral-900">
                    Redeem Your Points
                  </h3>
                  <p className="text-xs text-neutral-500">
                    You can redeem{' '}
                    <span className="font-medium text-neutral-700">
                      {(Math.floor(balance.points / 100) * 100).toLocaleString()} points
                    </span>{' '}
                    for a{' '}
                    <span className="font-medium text-[#c8a97e]">
                      ${(balance.redeemableValue / 100).toFixed(2)} discount
                    </span>
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {redeemError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 text-xs text-red-600"
                  >
                    {redeemError}
                  </motion.p>
                )}
                {redeemSuccess && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 text-xs text-green-600"
                  >
                    {redeemSuccess}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="mt-4 bg-neutral-900 px-6 py-2.5 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {isRedeeming ? 'Redeeming...' : 'Redeem Points'}
              </button>
            </motion.div>
          )}

          {/* How it works */}
          <motion.div
            className="mt-6 border border-neutral-100 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
              How It Works
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <Star className="h-4 w-4 text-[#c8a97e]" />
                <p className="mt-2 text-sm font-medium text-neutral-900">Earn Points</p>
                <p className="mt-1 text-xs text-neutral-500">
                  1 point for every $1 spent on orders
                </p>
              </div>
              <div>
                <Gift className="h-4 w-4 text-[#c8a97e]" />
                <p className="mt-2 text-sm font-medium text-neutral-900">Redeem Rewards</p>
                <p className="mt-1 text-xs text-neutral-500">
                  100 points = $5 discount on your next order
                </p>
              </div>
              <div>
                <Crown className="h-4 w-4 text-[#c8a97e]" />
                <p className="mt-2 text-sm font-medium text-neutral-900">Climb Tiers</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Reach higher tiers for exclusive benefits
                </p>
              </div>
            </div>
          </motion.div>

          {/* Transaction History */}
          <div className="mt-10">
            <h2 className="text-xs font-medium tracking-widest text-neutral-500 uppercase">
              Points History
            </h2>

            {transactions.length === 0 ? (
              <div className="mt-6 text-center">
                <Star className="mx-auto h-10 w-10 text-neutral-200" />
                <p className="mt-3 text-sm text-neutral-500">
                  No transactions yet. Start shopping to earn points.
                </p>
              </div>
            ) : (
              <motion.div
                className="mt-4 space-y-2"
                initial="hidden"
                animate="visible"
                variants={stagger}
              >
                {transactions.map((tx) => (
                  <motion.div
                    key={tx.id}
                    variants={fadeUp}
                    className="flex items-center justify-between border border-neutral-100 px-5 py-4 transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center',
                          tx.points > 0 ? 'bg-green-50' : 'bg-red-50',
                        )}
                      >
                        {tx.points > 0 ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-neutral-900">{tx.description}</p>
                        <p className="text-2xs text-neutral-400">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'font-mono text-sm font-medium',
                        tx.points > 0 ? 'text-green-600' : 'text-red-500',
                      )}
                    >
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
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
          </div>
        </motion.div>
      </div>
    </div>
  );
}
