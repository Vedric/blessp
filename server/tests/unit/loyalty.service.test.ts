import { LoyaltyService } from '@features/loyalty/loyalty.service';
import { LoyaltyRepository } from '@features/loyalty/loyalty.repository';
import { ValidationError } from '@core/errors/http.errors';
import { makeLoyaltyTransactionFixture } from '../fixtures/loyalty.fixture';

jest.mock('@features/loyalty/loyalty.repository');
jest.mock('@core/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let loyaltyRepository: jest.Mocked<LoyaltyRepository>;

  const userId = 'usr_loyal';

  beforeEach(() => {
    jest.clearAllMocks();

    loyaltyRepository = {
      getBalance: jest.fn(),
      getTransactions: jest.fn(),
      createTransaction: jest.fn(),
      hasEarnedForOrder: jest.fn(),
    } as unknown as jest.Mocked<LoyaltyRepository>;

    service = new LoyaltyService(loyaltyRepository);
  });

  describe('getBalance', () => {
    it('returns Bronze tier for a new user with zero points', async () => {
      loyaltyRepository.getBalance.mockResolvedValueOnce(0);

      const result = await service.getBalance(userId);

      expect(result.points).toBe(0);
      expect(result.tier).toBe('Bronze');
      expect(result.nextTier).toBe('Silver');
      expect(result.pointsToNextTier).toBe(500);
      expect(result.redeemableValue).toBe(0);
    });

    it('returns Silver tier with correct next tier info', async () => {
      loyaltyRepository.getBalance.mockResolvedValueOnce(750);

      const result = await service.getBalance(userId);

      expect(result.tier).toBe('Silver');
      expect(result.nextTier).toBe('Gold');
      expect(result.pointsToNextTier).toBe(1250); // 2000 - 750
    });

    it('returns Gold tier', async () => {
      loyaltyRepository.getBalance.mockResolvedValueOnce(3000);

      const result = await service.getBalance(userId);

      expect(result.tier).toBe('Gold');
      expect(result.nextTier).toBe('Platinum');
      expect(result.pointsToNextTier).toBe(2000); // 5000 - 3000
    });

    it('returns Platinum tier with no next tier', async () => {
      loyaltyRepository.getBalance.mockResolvedValueOnce(6000);

      const result = await service.getBalance(userId);

      expect(result.tier).toBe('Platinum');
      expect(result.nextTier).toBeNull();
      expect(result.pointsToNextTier).toBe(0);
    });

    it('calculates redeemable value correctly', async () => {
      loyaltyRepository.getBalance.mockResolvedValueOnce(350);

      const result = await service.getBalance(userId);

      // 350 points = 3 full blocks of 100 = 3 * 500 cents = 1500 cents
      expect(result.redeemableValue).toBe(1500);
    });
  });

  describe('getTransactions', () => {
    it('returns paginated transactions', async () => {
      const transactions = [
        makeLoyaltyTransactionFixture(),
        makeLoyaltyTransactionFixture({ id: 'lt_002', points: -100, type: 'redeemed' }),
      ];

      loyaltyRepository.getTransactions.mockResolvedValueOnce({
        items: transactions,
        totalItems: 2,
        page: 1,
        perPage: 20,
        totalPages: 1,
      } as any);

      const result = await service.getTransactions(userId, { page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('redeemPoints', () => {
    it('redeems points in valid multiples of 100', async () => {
      loyaltyRepository.getBalance.mockResolvedValueOnce(500);
      loyaltyRepository.createTransaction.mockResolvedValueOnce(
        makeLoyaltyTransactionFixture({
          id: 'lt_redeem',
          points: -200,
          type: 'redeemed',
          description: 'Redeemed 200 points for a $10.00 discount',
          orderId: null,
        }) as any,
      );

      const result = await service.redeemPoints(userId, { points: 200 });

      expect(result.points).toBe(-200);
      expect(result.type).toBe('redeemed');
      expect(loyaltyRepository.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          points: -200,
          type: 'redeemed',
        }),
      );
    });

    it('throws ValidationError when points are not a multiple of 100', async () => {
      await expect(service.redeemPoints(userId, { points: 150 })).rejects.toThrow(ValidationError);
      expect(loyaltyRepository.getBalance).not.toHaveBeenCalled();
    });

    it('throws ValidationError when balance is insufficient', async () => {
      loyaltyRepository.getBalance.mockResolvedValueOnce(50);

      await expect(service.redeemPoints(userId, { points: 100 })).rejects.toThrow(ValidationError);
      expect(loyaltyRepository.createTransaction).not.toHaveBeenCalled();
    });
  });

  describe('awardPointsForOrder', () => {
    it('awards points based on order total', async () => {
      loyaltyRepository.hasEarnedForOrder.mockResolvedValueOnce(false);
      loyaltyRepository.createTransaction.mockResolvedValueOnce(
        makeLoyaltyTransactionFixture({ points: 50 }) as any,
      );

      await service.awardPointsForOrder(userId, 'ord_001', 5000);

      expect(loyaltyRepository.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          points: 50, // 5000 cents / 100 = 50 points
          type: 'earned',
          orderId: 'ord_001',
        }),
      );
    });

    it('skips awarding when points were already given for the order', async () => {
      loyaltyRepository.hasEarnedForOrder.mockResolvedValueOnce(true);

      await service.awardPointsForOrder(userId, 'ord_001', 5000);

      expect(loyaltyRepository.createTransaction).not.toHaveBeenCalled();
    });

    it('does not award points when the order total yields zero points', async () => {
      loyaltyRepository.hasEarnedForOrder.mockResolvedValueOnce(false);

      await service.awardPointsForOrder(userId, 'ord_001', 50); // 50 cents = 0 points

      expect(loyaltyRepository.createTransaction).not.toHaveBeenCalled();
    });
  });
});
