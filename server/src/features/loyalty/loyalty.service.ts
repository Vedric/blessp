import { ValidationError } from '../../core/errors/http.errors';
import { logger } from '../../core/observability/logger';
import { LoyaltyRepository } from './loyalty.repository';
import {
  CENTS_PER_POINT,
  POINTS_PER_REDEMPTION_UNIT,
  REDEMPTION_VALUE_CENTS,
  TIER_THRESHOLDS,
  type LoyaltyBalanceResponse,
  type LoyaltyTier,
  type LoyaltyTransactionResponse,
  type LoyaltyTransactionQueryParams,
  type RedeemPointsDto,
} from './loyalty.types';

export class LoyaltyService {
  constructor(private readonly loyaltyRepository: LoyaltyRepository) {}

  async getBalance(userId: string): Promise<LoyaltyBalanceResponse> {
    const points = await this.loyaltyRepository.getBalance(userId);
    const tier = this.computeTier(points);
    const nextTier = this.computeNextTier(tier);
    const pointsToNextTier = nextTier
      ? TIER_THRESHOLDS.find((t) => t.tier === nextTier)!.minPoints - points
      : 0;

    // How many full 100-point blocks the user can redeem, converted to cents
    const redeemableUnits = Math.floor(points / POINTS_PER_REDEMPTION_UNIT);
    const redeemableValue = redeemableUnits * REDEMPTION_VALUE_CENTS;

    return {
      points,
      tier,
      nextTier,
      pointsToNextTier,
      redeemableValue,
    };
  }

  async getTransactions(userId: string, params: LoyaltyTransactionQueryParams) {
    const result = await this.loyaltyRepository.getTransactions(userId, params);

    return {
      data: result.items.map((item): LoyaltyTransactionResponse => ({
        id: item.id,
        points: item.points,
        type: item.type as LoyaltyTransactionResponse['type'],
        description: item.description,
        orderId: item.orderId,
        createdAt: item.createdAt,
      })),
      pagination: {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    };
  }

  async redeemPoints(userId: string, dto: RedeemPointsDto): Promise<LoyaltyTransactionResponse> {
    if (dto.points % POINTS_PER_REDEMPTION_UNIT !== 0) {
      throw new ValidationError(
        `Points must be redeemed in multiples of ${POINTS_PER_REDEMPTION_UNIT}.`,
      );
    }

    const currentBalance = await this.loyaltyRepository.getBalance(userId);
    if (currentBalance < dto.points) {
      throw new ValidationError(
        `Insufficient points. Current balance: ${currentBalance}, requested: ${dto.points}.`,
      );
    }

    const discountCents = (dto.points / POINTS_PER_REDEMPTION_UNIT) * REDEMPTION_VALUE_CENTS;
    const discountDollars = (discountCents / 100).toFixed(2);

    const transaction = await this.loyaltyRepository.createTransaction({
      userId,
      points: -dto.points,
      type: 'redeemed',
      description: `Redeemed ${dto.points} points for a $${discountDollars} discount`,
    });

    logger.info(
      { userId, points: dto.points, discountCents },
      'Loyalty points redeemed',
    );

    return {
      id: transaction.id,
      points: transaction.points,
      type: transaction.type as LoyaltyTransactionResponse['type'],
      description: transaction.description,
      orderId: transaction.orderId,
      createdAt: transaction.createdAt,
    };
  }

  /**
   * Called when an order is marked as paid. Awards 1 point per $1 spent.
   * Idempotent: skips if points were already awarded for this order.
   */
  async awardPointsForOrder(userId: string, orderId: string, totalCents: number): Promise<void> {
    const alreadyAwarded = await this.loyaltyRepository.hasEarnedForOrder(userId, orderId);
    if (alreadyAwarded) {
      logger.debug({ userId, orderId }, 'Loyalty points already awarded for this order, skipping');
      return;
    }

    const points = Math.floor(totalCents / CENTS_PER_POINT);
    if (points <= 0) {
      return;
    }

    await this.loyaltyRepository.createTransaction({
      userId,
      points,
      type: 'earned',
      description: `Earned ${points} points from order #${orderId.slice(0, 8).toUpperCase()}`,
      orderId,
    });

    logger.info({ userId, orderId, points }, 'Loyalty points awarded for order');
  }

  private computeTier(points: number): LoyaltyTier {
    for (const { tier, minPoints } of TIER_THRESHOLDS) {
      if (points >= minPoints) {
        return tier;
      }
    }
    return 'Bronze';
  }

  private computeNextTier(currentTier: LoyaltyTier): LoyaltyTier | null {
    const tierOrder: LoyaltyTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    const currentIndex = tierOrder.indexOf(currentTier);
    if (currentIndex < tierOrder.length - 1) {
      return tierOrder[currentIndex + 1];
    }
    return null;
  }
}
