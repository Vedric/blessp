export interface WishlistItemResponse {
  id: string;
  productId: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    price: number;
    picture: string | null;
    images: string[];
    category: string | null;
    isActive: boolean;
  };
}

export interface AddToWishlistDto {
  productId: string;
}

export interface ToggleWishlistResult {
  added: boolean;
  item: WishlistItemResponse | null;
}
