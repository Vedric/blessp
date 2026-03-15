import { ProductsService } from '@features/products/products.service';
import { ProductsRepository } from '@features/products/products.repository';
import { VariantsRepository } from '@features/products/variants.repository';
import { CacheService } from '@core/cache/cache.service';
import { NotFoundError } from '@core/errors/http.errors';
import { makeProductFixture, makeInactiveProductFixture } from '../fixtures/product.fixture';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepository: jest.Mocked<ProductsRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    productsRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findFeatured: jest.fn(),
      findFilters: jest.fn(),
      findCompleteLookCandidates: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<ProductsRepository>;

    service = new ProductsService(productsRepository);
  });

  describe('listProducts', () => {
    it('returns paginated product results', async () => {
      const products = [
        makeProductFixture({ id: 'prod_001', name: 'Tee Alpha' }),
        makeProductFixture({ id: 'prod_002', name: 'Tee Beta' }),
      ];

      productsRepository.findAll.mockResolvedValueOnce({
        items: products,
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1,
      });

      const result = await service.listProducts({ page: 1, perPage: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.perPage).toBe(20);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('passes query parameters to the repository', async () => {
      productsRepository.findAll.mockResolvedValueOnce({
        items: [],
        page: 2,
        perPage: 10,
        totalItems: 0,
        totalPages: 0,
      });

      const params = { page: 2, perPage: 10, category: 'tops', search: 'cotton' };
      await service.listProducts(params);

      expect(productsRepository.findAll).toHaveBeenCalledWith(params);
    });

    it('returns an empty list when no products match', async () => {
      productsRepository.findAll.mockResolvedValueOnce({
        items: [],
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
      });

      const result = await service.listProducts({});

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });
  });

  describe('getProduct', () => {
    it('returns the product when found', async () => {
      const product = makeProductFixture();
      productsRepository.findById.mockResolvedValueOnce(product);

      const result = await service.getProduct(product.id);

      expect(result.id).toBe(product.id);
      expect(result.name).toBe(product.name);
      expect(result.price).toBe(product.price);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundError when product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getProduct('prod_nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createProduct', () => {
    it('creates and returns a product', async () => {
      const dto = {
        name: 'New Hoodie',
        price: 7500,
        description: 'Warm and cozy.',
        category: 'outerwear',
      };

      const createdProduct = makeProductFixture({
        id: 'prod_new-001',
        name: dto.name,
        price: dto.price,
        description: dto.description,
        category: dto.category,
      });

      productsRepository.create.mockResolvedValueOnce(createdProduct);

      const result = await service.createProduct(dto);

      expect(result.id).toBe('prod_new-001');
      expect(result.name).toBe(dto.name);
      expect(result.price).toBe(dto.price);
      expect(productsRepository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateProduct', () => {
    it('updates and returns the product', async () => {
      const existing = makeProductFixture();
      const updateDto = { name: 'Updated Tee', price: 4000 };
      const updatedProduct = makeProductFixture({
        name: updateDto.name,
        price: updateDto.price,
        updatedAt: new Date('2025-08-01'),
      });

      productsRepository.findById.mockResolvedValueOnce(existing);
      productsRepository.update.mockResolvedValueOnce(updatedProduct);

      const result = await service.updateProduct(existing.id, updateDto);

      expect(result.name).toBe('Updated Tee');
      expect(result.price).toBe(4000);
    });

    it('throws NotFoundError when the product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateProduct('prod_nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteProduct', () => {
    it('soft-deletes the product when it exists', async () => {
      const product = makeProductFixture();
      productsRepository.findById.mockResolvedValueOnce(product);
      productsRepository.softDelete.mockResolvedValueOnce(undefined as any);

      await service.deleteProduct(product.id);

      expect(productsRepository.softDelete).toHaveBeenCalledWith(product.id);
    });

    it('throws NotFoundError when the product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deleteProduct('prod_nonexistent')).rejects.toThrow(NotFoundError);
      expect(productsRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('getFeaturedProducts', () => {
    it('returns a list of featured products', async () => {
      const featured = [
        makeProductFixture({ id: 'prod_f1', onfrontOrder: 1 }),
        makeProductFixture({ id: 'prod_f2', onfrontOrder: 2 }),
      ];

      productsRepository.findFeatured.mockResolvedValueOnce(featured);

      const result = await service.getFeaturedProducts();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('prod_f1');
    });
  });

  describe('getFilters', () => {
    it('delegates to the repository and returns filter options', async () => {
      const filters = {
        categories: ['tops', 'bottoms'],
        colors: ['black', 'white'],
        sizes: ['S', 'M', 'L'],
        priceRange: { min: 2000, max: 15000 },
      };

      productsRepository.findFilters.mockResolvedValueOnce(filters);

      const result = await service.getFilters();

      expect(result).toEqual(filters);
      expect(productsRepository.findFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCompleteLook', () => {
    it('throws NotFoundError when the product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getCompleteLook('prod_missing')).rejects.toThrow(NotFoundError);
    });

    it('returns an empty array for set/ensemble categories', async () => {
      const setProduct = makeProductFixture({ id: 'prod_set', category: 'Set Complet' });
      productsRepository.findById.mockResolvedValueOnce(setProduct);

      const result = await service.getCompleteLook('prod_set');

      expect(result).toEqual([]);
      expect(productsRepository.findCompleteLookCandidates).not.toHaveBeenCalled();
    });

    it('returns an empty array for ensemble categories', async () => {
      const ensembleProduct = makeProductFixture({ id: 'prod_ens', category: 'Ensemble Sport' });
      productsRepository.findById.mockResolvedValueOnce(ensembleProduct);

      const result = await service.getCompleteLook('prod_ens');

      expect(result).toEqual([]);
    });

    it('returns an empty array when no complementary categories exist', async () => {
      // Categories like "accessories" have no pairing defined
      const accessory = makeProductFixture({ id: 'prod_acc', category: 'accessories' });
      productsRepository.findById.mockResolvedValueOnce(accessory);

      const result = await service.getCompleteLook('prod_acc');

      expect(result).toEqual([]);
      expect(productsRepository.findCompleteLookCandidates).not.toHaveBeenCalled();
    });

    it('returns scored candidates prioritizing exact color matches', async () => {
      const hoodie = makeProductFixture({
        id: 'prod_hoodie',
        category: 'hoodie',
        colors: ['black'],
      });

      const candidateExact = makeProductFixture({
        id: 'prod_pants_black',
        category: 'pants',
        colors: ['black'],
      });
      const candidateNoMatch = makeProductFixture({
        id: 'prod_pants_red',
        category: 'pants',
        colors: ['red'],
      });

      productsRepository.findById.mockResolvedValueOnce(hoodie);
      productsRepository.findCompleteLookCandidates.mockResolvedValueOnce([
        candidateNoMatch,
        candidateExact,
      ]);

      const result = await service.getCompleteLook('prod_hoodie');

      // Exact color match should be ranked first
      expect(result[0].id).toBe('prod_pants_black');
      expect(result).toHaveLength(2);
    });

    it('scores complementary colors higher than no color match', async () => {
      const blackHoodie = makeProductFixture({
        id: 'prod_hoodie_bw',
        category: 'hoodie',
        colors: ['black'],
      });

      const whiteCandidate = makeProductFixture({
        id: 'prod_pants_white',
        category: 'pants',
        colors: ['white'],
      });
      const greenCandidate = makeProductFixture({
        id: 'prod_pants_green',
        category: 'pants',
        colors: ['green'],
      });

      productsRepository.findById.mockResolvedValueOnce(blackHoodie);
      productsRepository.findCompleteLookCandidates.mockResolvedValueOnce([
        greenCandidate,
        whiteCandidate,
      ]);

      const result = await service.getCompleteLook('prod_hoodie_bw');

      // White is complementary to black, green has no relation
      expect(result[0].id).toBe('prod_pants_white');
      expect(result[1].id).toBe('prod_pants_green');
    });

    it('limits results to a maximum of four items', async () => {
      const hoodie = makeProductFixture({
        id: 'prod_hoodie_many',
        category: 'hoodie',
        colors: ['black'],
      });

      const candidates = Array.from({ length: 6 }, (_, i) =>
        makeProductFixture({
          id: `prod_cand_${i}`,
          category: 'pants',
          colors: ['black'],
        }),
      );

      productsRepository.findById.mockResolvedValueOnce(hoodie);
      productsRepository.findCompleteLookCandidates.mockResolvedValueOnce(candidates);

      const result = await service.getCompleteLook('prod_hoodie_many');

      expect(result).toHaveLength(4);
    });

    it('handles products with a null category gracefully', async () => {
      const product = makeProductFixture({ id: 'prod_null_cat', category: null, colors: ['black'] });
      productsRepository.findById.mockResolvedValueOnce(product);

      const result = await service.getCompleteLook('prod_null_cat');

      // Null category yields empty string, which has no complementary pairing
      expect(result).toEqual([]);
    });
  });

  describe('getVariants', () => {
    let variantsRepository: jest.Mocked<VariantsRepository>;

    beforeEach(() => {
      variantsRepository = {
        findByProductId: jest.fn(),
        upsertMany: jest.fn(),
      } as unknown as jest.Mocked<VariantsRepository>;

      service = new ProductsService(productsRepository, variantsRepository);
    });

    it('returns variants for an existing product', async () => {
      const product = makeProductFixture();
      const variants = [
        { id: 'var_1', productId: product.id, size: 'M', color: 'black', stock: 10, sku: 'SKU-001' },
        { id: 'var_2', productId: product.id, size: 'L', color: 'white', stock: 3, sku: null },
      ];

      productsRepository.findById.mockResolvedValueOnce(product);
      variantsRepository.findByProductId.mockResolvedValueOnce(variants);

      const result = await service.getVariants(product.id);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'var_1',
        productId: product.id,
        size: 'M',
        color: 'black',
        stock: 10,
        sku: 'SKU-001',
      });
      expect(result[1].sku).toBeNull();
    });

    it('throws NotFoundError when the product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getVariants('prod_ghost')).rejects.toThrow(NotFoundError);
      expect(variantsRepository.findByProductId).not.toHaveBeenCalled();
    });
  });

  describe('updateVariants', () => {
    let variantsRepository: jest.Mocked<VariantsRepository>;

    beforeEach(() => {
      variantsRepository = {
        findByProductId: jest.fn(),
        upsertMany: jest.fn(),
      } as unknown as jest.Mocked<VariantsRepository>;

      service = new ProductsService(productsRepository, variantsRepository);
    });

    it('upserts variants and returns the updated list', async () => {
      const product = makeProductFixture();
      const updates = [
        { size: 'M', color: 'black', stock: 20, sku: 'SKU-UPD-1' },
      ];
      const savedVariants = [
        { id: 'var_u1', productId: product.id, size: 'M', color: 'black', stock: 20, sku: 'SKU-UPD-1' },
      ];

      productsRepository.findById.mockResolvedValueOnce(product);
      variantsRepository.upsertMany.mockResolvedValueOnce(undefined as any);
      variantsRepository.findByProductId.mockResolvedValueOnce(savedVariants);

      const result = await service.updateVariants(product.id, updates);

      expect(variantsRepository.upsertMany).toHaveBeenCalledWith(product.id, updates);
      expect(result).toHaveLength(1);
      expect(result[0].stock).toBe(20);
    });

    it('throws NotFoundError when the product does not exist', async () => {
      productsRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateVariants('prod_ghost', [{ size: 'S', color: 'red', stock: 5 }]),
      ).rejects.toThrow(NotFoundError);
      expect(variantsRepository.upsertMany).not.toHaveBeenCalled();
    });
  });

  describe('toProductResponse (hasLowStock)', () => {
    it('sets hasLowStock to true when a variant has stock between 1 and 5', async () => {
      const product = makeProductFixture({
        id: 'prod_low',
        variants: [{ stock: 3 }, { stock: 50 }],
      } as any);

      productsRepository.findById.mockResolvedValueOnce(product);

      const result = await service.getProduct('prod_low');

      expect(result.hasLowStock).toBe(true);
    });

    it('sets hasLowStock to false when all variants have stock above 5', async () => {
      const product = makeProductFixture({
        id: 'prod_high',
        variants: [{ stock: 10 }, { stock: 50 }],
      } as any);

      productsRepository.findById.mockResolvedValueOnce(product);

      const result = await service.getProduct('prod_high');

      expect(result.hasLowStock).toBe(false);
    });

    it('sets hasLowStock to false when all variants are out of stock', async () => {
      // Zero stock does not count as "low stock" since it is fully depleted
      const product = makeProductFixture({
        id: 'prod_zero',
        variants: [{ stock: 0 }],
      } as any);

      productsRepository.findById.mockResolvedValueOnce(product);

      const result = await service.getProduct('prod_zero');

      expect(result.hasLowStock).toBe(false);
    });

    it('sets hasLowStock to false when no variants are present', async () => {
      const product = makeProductFixture({ id: 'prod_no_variants' });
      productsRepository.findById.mockResolvedValueOnce(product);

      const result = await service.getProduct('prod_no_variants');

      expect(result.hasLowStock).toBe(false);
    });
  });

  describe('listProducts (caching)', () => {
    let cacheService: jest.Mocked<CacheService>;

    beforeEach(() => {
      cacheService = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      } as unknown as jest.Mocked<CacheService>;

      service = new ProductsService(productsRepository, undefined as any, cacheService);
    });

    it('returns cached data without querying the repository', async () => {
      const cachedResponse = {
        data: [{ id: 'prod_cached', name: 'Cached Tee' }],
        pagination: { page: 1, perPage: 20, totalItems: 1, totalPages: 1 },
      };

      cacheService.get.mockResolvedValueOnce(cachedResponse);

      const result = await service.listProducts({ page: 1, perPage: 20 });

      expect(result).toEqual(cachedResponse);
      expect(productsRepository.findAll).not.toHaveBeenCalled();
    });

    it('queries the repository and populates the cache on a cache miss', async () => {
      cacheService.get.mockResolvedValueOnce(null);

      const products = [makeProductFixture({ id: 'prod_fresh' })];
      productsRepository.findAll.mockResolvedValueOnce({
        items: products,
        page: 1,
        perPage: 20,
        totalItems: 1,
        totalPages: 1,
      });

      const result = await service.listProducts({ page: 1, perPage: 20 });

      expect(result.data).toHaveLength(1);
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('products:list:'),
        expect.objectContaining({ data: expect.any(Array) }),
        120,
      );
    });

    it('builds deterministic cache keys regardless of parameter order', async () => {
      cacheService.get.mockResolvedValue(null);
      productsRepository.findAll.mockResolvedValue({
        items: [],
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
      });

      await service.listProducts({ page: 1, category: 'tops', perPage: 20 });
      const firstCacheKey = cacheService.get.mock.calls[0][0];

      await service.listProducts({ category: 'tops', perPage: 20, page: 1 });
      const secondCacheKey = cacheService.get.mock.calls[1][0];

      // Keys should be identical because parameters are sorted
      expect(firstCacheKey).toBe(secondCacheKey);
    });

    it('excludes undefined and empty values from the cache key', async () => {
      cacheService.get.mockResolvedValue(null);
      productsRepository.findAll.mockResolvedValue({
        items: [],
        page: 1,
        perPage: 20,
        totalItems: 0,
        totalPages: 0,
      });

      await service.listProducts({ page: 1, perPage: 20, search: '', category: undefined } as any);
      const cacheKey = cacheService.get.mock.calls[0][0];

      // Empty string and undefined values should not appear in the key
      expect(cacheKey).not.toContain('"search"');
      expect(cacheKey).not.toContain('"category"');
    });
  });
});
