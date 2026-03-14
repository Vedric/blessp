import { NotFoundError, ValidationError, ConflictError } from '../../core/errors/http.errors';
import { CouponsRepository } from './coupons.repository';
import type {
  CouponResponse,
  ApplyCouponResult,
  CreateCouponDto,
  UpdateCouponDto,
} from './coupons.types';

export class CouponsService {
  constructor(private readonly couponsRepository: CouponsRepository) {}

  async validateCoupon(code: string, orderTotalCents: number): Promise<ApplyCouponResult> {
    const coupon = await this.couponsRepository.findByCode(code.toUpperCase());

    if (!coupon) {
      throw new NotFoundError('Coupon', code);
    }

    if (!coupon.isActive) {
      throw new ValidationError('This coupon is no longer active.');
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new ValidationError('This coupon has expired.');
    }

    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      throw new ValidationError('This coupon has reached its maximum number of uses.');
    }

    if (coupon.minOrderCents !== null && orderTotalCents < coupon.minOrderCents) {
      const minAmount = (coupon.minOrderCents / 100).toFixed(2);
      throw new ValidationError(
        `This coupon requires a minimum order of $${minAmount}.`,
      );
    }

    const discountCents = this.calculateDiscount(
      coupon.discountType,
      coupon.discountValue,
      orderTotalCents,
    );

    return {
      coupon: this.toCouponResponse(coupon),
      discountCents,
    };
  }

  async applyCoupon(code: string, orderTotalCents: number): Promise<ApplyCouponResult> {
    const result = await this.validateCoupon(code, orderTotalCents);

    await this.couponsRepository.incrementUses(result.coupon.id);

    return result;
  }

  async createCoupon(dto: CreateCouponDto): Promise<CouponResponse> {
    const existing = await this.couponsRepository.findByCode(dto.code);

    if (existing) {
      throw new ConflictError(`A coupon with code '${dto.code}' already exists.`);
    }

    const coupon = await this.couponsRepository.create({
      code: dto.code,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minOrderCents: dto.minOrderCents,
      maxUses: dto.maxUses,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    return this.toCouponResponse(coupon);
  }

  async listCoupons(): Promise<CouponResponse[]> {
    const coupons = await this.couponsRepository.findAll();
    return coupons.map(this.toCouponResponse);
  }

  async updateCoupon(id: string, dto: UpdateCouponDto): Promise<CouponResponse> {
    const coupon = await this.couponsRepository.findById(id);

    if (!coupon) {
      throw new NotFoundError('Coupon', id);
    }

    const updateData: { isActive?: boolean; maxUses?: number | null; expiresAt?: Date | null } = {};

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    if (dto.maxUses !== undefined) {
      updateData.maxUses = dto.maxUses;
    }

    if (dto.expiresAt !== undefined) {
      updateData.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    const updated = await this.couponsRepository.update(id, updateData);
    return this.toCouponResponse(updated);
  }

  private calculateDiscount(
    discountType: string,
    discountValue: number,
    orderTotalCents: number,
  ): number {
    if (discountType === 'percentage') {
      return Math.round((orderTotalCents * discountValue) / 100);
    }

    // Fixed discount: cannot exceed the order total
    return Math.min(discountValue, orderTotalCents);
  }

  private toCouponResponse(coupon: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    minOrderCents: number | null;
    maxUses: number | null;
    currentUses: number;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
  }): CouponResponse {
    return {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType as 'percentage' | 'fixed',
      discountValue: coupon.discountValue,
      minOrderCents: coupon.minOrderCents,
      maxUses: coupon.maxUses,
      currentUses: coupon.currentUses,
      isActive: coupon.isActive,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
      createdAt: coupon.createdAt.toISOString(),
    };
  }
}
