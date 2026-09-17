/**
 * Factory functions for product-related test data.
 */

export interface ProductFixture {
  id: string;
  name: string;
  price: number;
  description: string | null;
  details: string | null;
  picture: string | null;
  images: string[];
  category: string | null;
  colors: string[];
  sizes: string[];
  isActive: boolean;
  onfrontOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const defaults: ProductFixture = {
  id: 'prod_default-0001',
  name: 'Blessed Tee',
  price: 3500,
  description: 'A premium cotton tee shirt.',
  details: '100% organic cotton, made in France.',
  picture: 'https://cdn.example.com/products/tee-black.jpg',
  images: [
    'https://cdn.example.com/products/tee-black-1.jpg',
    'https://cdn.example.com/products/tee-black-2.jpg',
  ],
  category: 'tops',
  colors: ['black', 'white'],
  sizes: ['S', 'M', 'L', 'XL'],
  isActive: true,
  onfrontOrder: null,
  createdAt: new Date('2025-05-15T08:00:00Z'),
  updatedAt: new Date('2025-05-15T08:00:00Z'),
  deletedAt: null,
};

export function makeProductFixture(overrides: Partial<ProductFixture> = {}): ProductFixture {
  return { ...defaults, ...overrides };
}

export function makeInactiveProductFixture(overrides: Partial<ProductFixture> = {}): ProductFixture {
  return makeProductFixture({
    id: 'prod_inactive-0001',
    name: 'Discontinued Hoodie',
    isActive: false,
    ...overrides,
  });
}

export function makeFeaturedProductFixture(overrides: Partial<ProductFixture> = {}): ProductFixture {
  return makeProductFixture({
    id: 'prod_featured-0001',
    name: 'Featured Cap',
    onfrontOrder: 1,
    ...overrides,
  });
}
