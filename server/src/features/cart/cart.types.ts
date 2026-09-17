export interface CartItemResponse {
  id: string;
  productId: string;
  quantity: number;
  size: string | null;
  color: string | null;
  product: {
    id: string;
    name: string;
    price: number;
    picture: string | null;
    isActive: boolean;
  };
}

export interface CartResponse {
  items: CartItemResponse[];
  totalCents: number;
  itemCount: number;
}

export interface AddToCartDto {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

export interface UpdateCartItemDto {
  quantity: number;
}
