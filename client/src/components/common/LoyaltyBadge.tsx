import { Crown, Star, Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoyaltyTier } from '@/lib/types';

const TIER_DISPLAY: Record<LoyaltyTier, {
  icon: typeof Crown;
  color: string;
  bg: string;
}> = {
  Bronze: { icon: Star, color: 'text-amber-700', bg: 'bg-amber-50' },
  Silver: { icon: Trophy, color: 'text-neutral-500', bg: 'bg-neutral-100' },
  Gold: { icon: Crown, color: 'text-[#c8a97e]', bg: 'bg-[#c8a97e]/10' },
  Platinum: { icon: Sparkles, color: 'text-violet-500', bg: 'bg-violet-50' },
};

interface LoyaltyBadgeProps {
  tier: LoyaltyTier;
  points: number;
  className?: string;
}

export function LoyaltyBadge({ tier, points, className }: LoyaltyBadgeProps) {
  const config = TIER_DISPLAY[tier];
  const TierIcon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium',
        config.bg,
        className,
      )}
    >
      <TierIcon className={cn('h-3.5 w-3.5', config.color)} />
      <span className={config.color}>{tier}</span>
      <span className="text-neutral-400">&middot;</span>
      <span className="text-neutral-600">{points.toLocaleString()} pts</span>
    </div>
  );
}
