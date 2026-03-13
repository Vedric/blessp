export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'bonus';

export interface LoyaltyTransactionResponse {
  id: string;
  points: number;
  type: LoyaltyTransactionType;
  description: string;
  orderId: string | null;
  createdAt: Date;
}

export interface LoyaltyBalanceResponse {
  points: number;
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number;
  redeemableValue: number;
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface RedeemPointsDto {
  points: number;
}

export interface LoyaltyTransactionQueryParams {
  page?: number;
  perPage?: number;
}

/** Conversion rate: 100 points = $5.00 discount (500 cents) */
export const POINTS_PER_REDEMPTION_UNIT = 100;
export const REDEMPTION_VALUE_CENTS = 500;

/** Earning rate: 1 point per $1 spent (per 100 cents) */
export const CENTS_PER_POINT = 100;

/** Tier thresholds */
export const TIER_THRESHOLDS: { tier: LoyaltyTier; minPoints: number }[] = [
  { tier: 'Platinum', minPoints: 5000 },
  { tier: 'Gold', minPoints: 2000 },
  { tier: 'Silver', minPoints: 500 },
  { tier: 'Bronze', minPoints: 0 },
];
