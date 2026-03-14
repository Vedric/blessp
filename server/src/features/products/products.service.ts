import { NotFoundError } from '../../core/errors/http.errors';
import { CacheService } from '../../core/cache/cache.service';
import { ProductsRepository } from './products.repository';
import { VariantsRepository, UpdateVariantInput } from './variants.repository';
import { ProductResponse, ProductFiltersResponse, ProductVariantResponse, CreateProductDto, UpdateProductDto, ProductQueryParams } from './products.types';

export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly variantsRepository: VariantsRepository = new VariantsRepository(),
    private readonly cache: CacheService = new CacheService(null),
  ) {}

  async listProducts(params: ProductQueryParams) {
    const cacheKey = this.buildListCacheKey(params);

    type ListResult = { data: ProductResponse[]; pagination: { page: number; perPage: number; totalItems: number; totalPages: number } };
    const cached = await this.cache.get<ListResult>(cacheKey);
    if (cached) return cached;

    const result = await this.productsRepository.findAll(params);
    const response: ListResult = {
      data: result.items.map(this.toProductResponse),
      pagination: {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    };

    await this.cache.set(cacheKey, response, 120);
    return response;
  }

  private buildListCacheKey(params: ProductQueryParams): string {
    const sorted = Object.keys(params)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const value = params[key as keyof ProductQueryParams];
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = value;
        }
        return acc;
      }, {});
    return `products:list:${JSON.stringify(sorted)}`;
  }

  async getProduct(id: string): Promise<ProductResponse> {
    const product = await this.productsRepository.findById(id);

    if (!product) {
      throw new NotFoundError('Product', id);
    }

    return this.toProductResponse(product);
  }

  async getFilters(): Promise<ProductFiltersResponse> {
    return this.productsRepository.findFilters();
  }

  async getFeaturedProducts(): Promise<ProductResponse[]> {
    const products = await this.productsRepository.findFeatured();
    return products.map(this.toProductResponse);
  }

  async createProduct(dto: CreateProductDto): Promise<ProductResponse> {
    const product = await this.productsRepository.create(dto);
    return this.toProductResponse(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<ProductResponse> {
    const existing = await this.productsRepository.findById(id);

    if (!existing) {
      throw new NotFoundError('Product', id);
    }

    const product = await this.productsRepository.update(id, dto);
    return this.toProductResponse(product);
  }

  async deleteProduct(id: string): Promise<void> {
    const existing = await this.productsRepository.findById(id);

    if (!existing) {
      throw new NotFoundError('Product', id);
    }

    await this.productsRepository.softDelete(id);
  }

  async getCompleteLook(productId: string): Promise<ProductResponse[]> {
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    const category = (product.category ?? '').toLowerCase();
    const productColors = product.colors.map((c) => c.toLowerCase());

    // Sets already contain both pieces, so no pairing suggestion is needed
    if (category.includes('set') || category.includes('ensemble')) {
      return [];
    }

    // Determine which complementary categories to search for
    const complementaryCategories = this.getComplementaryCategories(category);
    if (complementaryCategories.length === 0) {
      return [];
    }

    const candidates = await this.productsRepository.findCompleteLookCandidates(
      productId,
      complementaryCategories,
      product.colors,
    );

    // Score candidates: prefer same color matches, then complementary colors
    const scored = candidates.map((candidate) => {
      const candidateColors = candidate.colors.map((c) => c.toLowerCase());
      const hasExactColorMatch = productColors.some((pc) => candidateColors.includes(pc));
      const hasComplementaryColor = this.hasComplementaryColor(productColors, candidateColors);

      let score = 0;
      if (hasExactColorMatch) score += 10;
      if (hasComplementaryColor) score += 5;

      return { product: candidate, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 4).map((s) => this.toProductResponse(s.product));
  }

  private getComplementaryCategories(category: string): string[] {
    // Mapping of product types to their natural pairings
    const pairings: Record<string, string[]> = {
      hoodie: ['pants', 'joggers', 'sweatpants', 'cargo pants'],
      hoodies: ['pants', 'joggers', 'sweatpants', 'cargo pants'],
      sweatshirt: ['pants', 'joggers', 'sweatpants', 'cargo pants'],
      pants: ['hoodie', 'hoodies', 'sweatshirt', 't-shirt', 'tee'],
      joggers: ['hoodie', 'hoodies', 'sweatshirt', 't-shirt', 'tee'],
      sweatpants: ['hoodie', 'hoodies', 'sweatshirt', 't-shirt', 'tee'],
      'cargo pants': ['hoodie', 'hoodies', 'sweatshirt', 't-shirt', 'tee'],
      't-shirt': ['pants', 'joggers', 'sweatpants', 'cargo pants'],
      tee: ['pants', 'joggers', 'sweatpants', 'cargo pants'],
      jacket: ['pants', 'joggers', 'sweatpants', 't-shirt', 'tee'],
      shorts: ['hoodie', 'hoodies', 'sweatshirt', 't-shirt', 'tee'],
    };

    return pairings[category] ?? [];
  }

  private hasComplementaryColor(colorsA: string[], colorsB: string[]): boolean {
    // Pairs of colors that work well together
    const complements: [string, string][] = [
      ['black', 'white'],
      ['black', 'gray'],
      ['black', 'grey'],
      ['navy', 'white'],
      ['white', 'blue'],
      ['black', 'blue'],
      ['gray', 'white'],
      ['grey', 'white'],
      ['black', 'pink'],
      ['navy', 'gray'],
      ['navy', 'grey'],
    ];

    for (const a of colorsA) {
      for (const b of colorsB) {
        const pair = complements.find(
          ([x, y]) => (x === a && y === b) || (x === b && y === a),
        );
        if (pair) return true;
      }
    }

    return false;
  }

  async getVariants(productId: string): Promise<ProductVariantResponse[]> {
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    const variants = await this.variantsRepository.findByProductId(productId);
    return variants.map(this.toVariantResponse);
  }

  async updateVariants(productId: string, updates: UpdateVariantInput[]): Promise<ProductVariantResponse[]> {
    const product = await this.productsRepository.findById(productId);
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    await this.variantsRepository.upsertMany(productId, updates);
    const variants = await this.variantsRepository.findByProductId(productId);
    return variants.map(this.toVariantResponse);
  }

  private toVariantResponse(variant: {
    id: string;
    productId: string;
    size: string;
    color: string;
    stock: number;
    sku: string | null;
  }): ProductVariantResponse {
    return {
      id: variant.id,
      productId: variant.productId,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      sku: variant.sku,
    };
  }

  private toProductResponse(product: {
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
    variants?: Array<{ stock: number }>;
  }): ProductResponse {
    const hasLowStock = product.variants
      ? product.variants.some((v) => v.stock > 0 && v.stock <= 5)
      : false;

    return {
      id: product.id,
      name: product.name,
      price: product.price,
      description: product.description,
      details: product.details,
      picture: product.picture,
      images: product.images,
      category: product.category,
      colors: product.colors,
      sizes: product.sizes,
      isActive: product.isActive,
      onfrontOrder: product.onfrontOrder,
      hasLowStock,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
