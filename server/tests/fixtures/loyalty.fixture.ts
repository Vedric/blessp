export function makeLoyaltyTransactionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lt_001',
    userId: 'usr_loyal',
    points: 50,
    type: 'earned',
    description: 'Earned 50 points from order #ORD12345',
    orderId: 'ord_001',
    createdAt: new Date('2025-06-01T10:00:00Z'),
    ...overrides,
  };
}
