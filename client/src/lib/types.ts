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
  hasLowStock?: boolean;
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
  status: 'pending' | 'paid' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
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

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  user: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  stock: number;
  sku: string | null;
}

export interface CouponValidation {
  coupon: {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  };
  discountCents: number;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface LoyaltyBalance {
  points: number;
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number;
  redeemableValue: number;
}

export interface LoyaltyTransaction {
  id: string;
  points: number;
  type: 'earned' | 'redeemed' | 'bonus';
  description: string;
  orderId: string | null;
  createdAt: string;
}
