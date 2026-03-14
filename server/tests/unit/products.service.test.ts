import { ProductsService } from '@features/products/products.service';
import { ProductsRepository } from '@features/products/products.repository';
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
});
