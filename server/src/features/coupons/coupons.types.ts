export interface CouponResponse {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderCents: number | null;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApplyCouponResult {
  coupon: CouponResponse;
  discountCents: number;
}

export interface CreateCouponDto {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderCents?: number;
  maxUses?: number;
  expiresAt?: string;
}

export interface UpdateCouponDto {
  isActive?: boolean;
  maxUses?: number | null;
  expiresAt?: string | null;
}

export interface ValidateCouponDto {
  code: string;
  orderTotalCents: number;
}
