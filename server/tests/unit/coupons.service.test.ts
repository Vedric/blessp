import { CouponsService } from '@features/coupons/coupons.service';
import { CouponsRepository } from '@features/coupons/coupons.repository';
import { NotFoundError, ValidationError, ConflictError } from '@core/errors/http.errors';
import { makeCouponFixture } from '../fixtures/coupon.fixture';

jest.mock('@features/coupons/coupons.repository');

describe('CouponsService', () => {
  let service: CouponsService;
  let couponsRepository: jest.Mocked<CouponsRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    couponsRepository = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      incrementUses: jest.fn(),
    } as unknown as jest.Mocked<CouponsRepository>;

    service = new CouponsService(couponsRepository);
  });

  describe('validateCoupon', () => {
    it('returns discount for a valid percentage coupon', async () => {
      const coupon = makeCouponFixture({ discountType: 'percentage', discountValue: 10 });
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      const result = await service.validateCoupon('SAVE10', 10000);

      expect(result.discountCents).toBe(1000); // 10% of 10000
      expect(result.coupon.code).toBe('SAVE10');
    });

    it('returns discount for a valid fixed coupon', async () => {
      const coupon = makeCouponFixture({ discountType: 'fixed', discountValue: 2500 });
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      const result = await service.validateCoupon('FLAT25', 10000);

      expect(result.discountCents).toBe(2500);
    });

    it('caps fixed discount at order total when discount exceeds total', async () => {
      const coupon = makeCouponFixture({ discountType: 'fixed', discountValue: 15000 });
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      const result = await service.validateCoupon('BIGDISCOUNT', 5000);

      expect(result.discountCents).toBe(5000);
    });

    it('throws NotFoundError when the coupon code does not exist', async () => {
      couponsRepository.findByCode.mockResolvedValueOnce(null);

      await expect(service.validateCoupon('INVALID', 10000)).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when the coupon is inactive', async () => {
      const coupon = makeCouponFixture({ isActive: false });
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      await expect(service.validateCoupon('SAVE10', 10000)).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when the coupon has expired', async () => {
      const coupon = makeCouponFixture({ expiresAt: new Date('2020-01-01T00:00:00Z') });
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      await expect(service.validateCoupon('SAVE10', 10000)).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when the coupon has reached max uses', async () => {
      const coupon = makeCouponFixture({ maxUses: 5, currentUses: 5 });
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      await expect(service.validateCoupon('SAVE10', 10000)).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when order total is below minimum', async () => {
      const coupon = makeCouponFixture({ minOrderCents: 5000 });
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      await expect(service.validateCoupon('SAVE10', 3000)).rejects.toThrow(ValidationError);
    });

    it('normalizes coupon code to uppercase before lookup', async () => {
      const coupon = makeCouponFixture();
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);

      await service.validateCoupon('save10', 10000);

      expect(couponsRepository.findByCode).toHaveBeenCalledWith('SAVE10');
    });
  });

  describe('applyCoupon', () => {
    it('validates and increments usage count', async () => {
      const coupon = makeCouponFixture();
      couponsRepository.findByCode.mockResolvedValueOnce(coupon as any);
      couponsRepository.incrementUses.mockResolvedValueOnce(undefined as any);

      const result = await service.applyCoupon('SAVE10', 10000);

      expect(result.discountCents).toBe(1000);
      expect(couponsRepository.incrementUses).toHaveBeenCalledWith(coupon.id);
    });

    it('does not increment uses when validation fails', async () => {
      couponsRepository.findByCode.mockResolvedValueOnce(null);

      await expect(service.applyCoupon('INVALID', 10000)).rejects.toThrow(NotFoundError);
      expect(couponsRepository.incrementUses).not.toHaveBeenCalled();
    });
  });

  describe('createCoupon', () => {
    const createDto = {
      code: 'NEWCODE',
      discountType: 'percentage' as const,
      discountValue: 15,
    };

    it('creates a coupon when the code is unique', async () => {
      couponsRepository.findByCode.mockResolvedValueOnce(null);
      const created = makeCouponFixture({ code: 'NEWCODE', discountValue: 15 });
      couponsRepository.create.mockResolvedValueOnce(created as any);

      const result = await service.createCoupon(createDto);

      expect(result.code).toBe('NEWCODE');
      expect(couponsRepository.create).toHaveBeenCalled();
    });

    it('throws ConflictError when a coupon with the same code exists', async () => {
      couponsRepository.findByCode.mockResolvedValueOnce(makeCouponFixture() as any);

      await expect(service.createCoupon(createDto)).rejects.toThrow(ConflictError);
      expect(couponsRepository.create).not.toHaveBeenCalled();
    });

    it('passes expiresAt as a Date when provided', async () => {
      couponsRepository.findByCode.mockResolvedValueOnce(null);
      couponsRepository.create.mockResolvedValueOnce(makeCouponFixture() as any);

      await service.createCoupon({ ...createDto, expiresAt: '2026-12-31T00:00:00Z' });

      expect(couponsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: expect.any(Date) }),
      );
    });
  });

  describe('listCoupons', () => {
    it('returns all coupons', async () => {
      const coupons = [makeCouponFixture(), makeCouponFixture({ id: 'cpn_002', code: 'FLAT20' })];
      couponsRepository.findAll.mockResolvedValueOnce(coupons as any);

      const result = await service.listCoupons();

      expect(result).toHaveLength(2);
    });
  });

  describe('updateCoupon', () => {
    it('updates a coupon when it exists', async () => {
      couponsRepository.findById.mockResolvedValueOnce(makeCouponFixture() as any);
      couponsRepository.update.mockResolvedValueOnce(
        makeCouponFixture({ isActive: false }) as any,
      );

      const result = await service.updateCoupon('cpn_001', { isActive: false });

      expect(result.isActive).toBe(false);
      expect(couponsRepository.update).toHaveBeenCalledWith(
        'cpn_001',
        expect.objectContaining({ isActive: false }),
      );
    });

    it('throws NotFoundError when the coupon does not exist', async () => {
      couponsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.updateCoupon('cpn_missing', { isActive: false })).rejects.toThrow(NotFoundError);
    });

    it('converts expiresAt string to Date', async () => {
      couponsRepository.findById.mockResolvedValueOnce(makeCouponFixture() as any);
      couponsRepository.update.mockResolvedValueOnce(makeCouponFixture() as any);

      await service.updateCoupon('cpn_001', { expiresAt: '2026-12-31T00:00:00Z' });

      expect(couponsRepository.update).toHaveBeenCalledWith(
        'cpn_001',
        expect.objectContaining({ expiresAt: expect.any(Date) }),
      );
    });

    it('sets expiresAt to null when passed null', async () => {
      couponsRepository.findById.mockResolvedValueOnce(makeCouponFixture() as any);
      couponsRepository.update.mockResolvedValueOnce(makeCouponFixture() as any);

      await service.updateCoupon('cpn_001', { expiresAt: null });

      expect(couponsRepository.update).toHaveBeenCalledWith(
        'cpn_001',
        expect.objectContaining({ expiresAt: null }),
      );
    });

    it('only includes provided fields in the update payload', async () => {
      couponsRepository.findById.mockResolvedValueOnce(makeCouponFixture() as any);
      couponsRepository.update.mockResolvedValueOnce(makeCouponFixture() as any);

      await service.updateCoupon('cpn_001', { maxUses: 50 });

      const updateCall = couponsRepository.update.mock.calls[0][1];
      expect(updateCall).toEqual({ maxUses: 50 });
      expect(updateCall).not.toHaveProperty('isActive');
      expect(updateCall).not.toHaveProperty('expiresAt');
    });
  });
});
