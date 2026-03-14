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
  userId: string;
  totalCents: number;
  discountCents: number;
  couponCode: string | null;
  status: string;
  transactionKey: string | null;
  shippingAddress: Record<string, unknown> | null;
  items: OrderItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderDto {
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
}

export interface OrderQueryParams {
  page?: number;
  perPage?: number;
  status?: string;
}
