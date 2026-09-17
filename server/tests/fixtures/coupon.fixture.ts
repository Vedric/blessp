export function makeCouponFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cpn_001',
    code: 'SAVE10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderCents: null as number | null,
    maxUses: null as number | null,
    currentUses: 0,
    isActive: true,
    expiresAt: null as Date | null,
    createdAt: new Date('2025-06-01T10:00:00Z'),
    ...overrides,
  };
}
