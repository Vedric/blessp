import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { CartItem, CartResponse } from '@/lib/types';

interface CartState {
  items: CartItem[];
  itemCount: number;
  total: number;
  isLoading: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (productId: string, size: string, color: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.get<CartResponse>('/cart');
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(
    async (productId: string, size: string, color: string, quantity = 1) => {
      const data = await api.post<CartResponse>('/cart/items', {
        productId,
        size,
        color,
        quantity,
      });
      setItems(data.items);
    },
    [],
  );

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const data = await api.patch<CartResponse>(`/cart/items/${itemId}`, { quantity });
    setItems(data.items);
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    const data = await api.delete<CartResponse>(`/cart/items/${itemId}`);
    setItems(data.items);
  }, []);

  const clearCart = useCallback(async () => {
    await api.delete('/cart');
    setItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        total,
        isLoading,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
