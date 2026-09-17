export interface OrderItemResponse {
  id: string;
  productId: string | null;
  productKey: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  size: string | null;
  color: string | null;
}

export interface OrderResponse {
  id: string;
  orderNumber: string | null;
  userId: string | null;
  guestEmail: string | null;
  totalCents: number;
  shippingCents: number;
  discountCents: number;
  couponCode: string | null;
  status: string;
  paymentStatus: string;
  paymentProvider: string;
  refundedCents: number;
  expiresAt: Date | null;
  transactionKey: string | null;
  shippingAddress: Record<string, unknown> | null;
  billingAddress: Record<string, unknown> | null;
  items: OrderItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

// Declared as a type alias rather than an interface so it stays assignable
// to the Record<string, unknown> JSON snapshot the repository persists.
export type BillingAddressDto = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  province?: string;
  country: string;
  phone?: string;
};

export interface CreateOrderDto {
  locale?: 'en' | 'fr';
  checkoutKey?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  province?: string;
  country: string;
  couponCode?: string;
  billingAddress?: BillingAddressDto;
}

export interface OrderQueryParams {
  page?: number;
  perPage?: number;
  status?: string;
}
