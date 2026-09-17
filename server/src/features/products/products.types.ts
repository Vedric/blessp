export interface ProductResponse {
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
  hasLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductDto {
  name: string;
  price: number;
  description?: string;
  details?: string;
  picture?: string;
  images?: string[];
  category?: string;
  colors?: string[];
  sizes?: string[];
  isActive?: boolean;
  onfrontOrder?: number;
}

export interface UpdateProductDto {
  name?: string;
  price?: number;
  description?: string | null;
  details?: string | null;
  picture?: string | null;
  images?: string[];
  category?: string | null;
  colors?: string[];
  sizes?: string[];
  isActive?: boolean;
  onfrontOrder?: number | null;
}

export interface ProductQueryParams {
  page?: number;
  perPage?: number;
  category?: string;
  search?: string;
  sort?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
}

export interface ProductFiltersResponse {
  categories: string[];
  colors: string[];
  sizes: string[];
  priceRange: { min: number; max: number };
}

export interface ProductVariantResponse {
  id: string;
  productId: string;
  size: string;
  color: string;
  stock: number;
  sku: string | null;
}

export interface UpdateVariantDto {
  size: string;
  color: string;
  stock: number;
  sku?: string | null;
}
