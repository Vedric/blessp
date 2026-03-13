/* Shared type definitions for the BLE$$ P client application */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  details: string;
  picture: string;
  images: string[];
  category: string;
  colors: string[];
  sizes: string[];
  isActive: boolean;
  onfrontOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemProduct {
  id: string;
  name: string;
  price: number;
  picture: string;
  isActive: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  size: string;
  color: string;
  product: CartItemProduct;
}

export interface CartResponse {
  items: CartItem[];
  totalCents: number;
  itemCount: number;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  province?: string;
  country: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productKey: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  size: string;
  color: string;
}

export interface Order {
  id: string;
  userId: string;
  totalCents: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  transactionKey: string | null;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  province?: string;
  country: string;
  addressType: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  fields?: Record<string, string[]>;
}

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface CouponValidation {
  coupon: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  };
  discountCents: number;
}
