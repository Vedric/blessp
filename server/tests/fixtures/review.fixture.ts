export function makeReviewFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev_001',
    userId: 'usr_reviewer',
    productId: 'prod_001',
    rating: 4,
    title: 'Great product',
    comment: 'Really enjoyed this item.',
    user: { firstName: 'Alice', lastName: 'Dupont' },
    createdAt: new Date('2025-06-01T10:00:00Z'),
    updatedAt: new Date('2025-06-01T10:00:00Z'),
    ...overrides,
  };
}

export function makeReviewWithProductFixture(overrides: Record<string, unknown> = {}) {
  return {
    ...makeReviewFixture(),
    product: { name: 'Blessed Tee' },
    ...overrides,
  };
}
