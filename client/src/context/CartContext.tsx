import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  readGuestCart,
  addGuestCartItem,
  updateGuestCartItem,
  removeGuestCartItem,
  clearGuestCart,
} from '@/lib/guestCart';
import type { CartItem, CartItemProduct, CartResponse } from '@/lib/types';

interface CartState {
  items: CartItem[];
  itemCount: number;
  total: number;
  isLoading: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (
    product: CartItemProduct,
    size: string,
    color: string,
    quantity?: number,
  ) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const owner = user?.id ?? null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const { t } = useTranslation();
  // Seed from the guest cart so pages that redirect on an empty cart (the
  // checkout) see guest items on the very first render after a hard load
  const [items, setItems] = useState<CartItem[]>(readGuestCart);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      // Guests keep a localStorage cart so checkout stays reachable without
      // an account; AuthContext merges it into the server cart on login.
      setItems(readGuestCart());
      setLoadedFor(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.get<CartResponse>('/cart');
      if (ownerRef.current === owner) setItems(data.items);
    } catch {
      if (ownerRef.current === owner) setItems([]);
    } finally {
      if (ownerRef.current === owner) { setIsLoading(false); setLoadedFor(owner); }
    }
  }, [isAuthenticated, owner]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(
    async (product: CartItemProduct, size: string, color: string, quantity = 1) => {
      try {
        if (isAuthenticated) {
          const data = await api.post<CartResponse>('/cart', {
            productId: product.id,
            quantity,
            size: size || undefined,
            color: color || undefined,
          });
          setItems(data.items);
        } else {
          setItems(addGuestCartItem(product, size, color, quantity));
        }
        toast.success(t('cart.added'));
      } catch (error) {
        // Feedback lives here so every add-to-cart call site benefits;
        // rethrow so callers can reset their own pending state
        toast.error(t('cart.addError'));
        throw error;
      }
    },
    [isAuthenticated, t],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        if (isAuthenticated) {
          const data = await api.patch<CartResponse>(`/cart/${itemId}`, { quantity });
          setItems(data.items);
        } else {
          setItems(updateGuestCartItem(itemId, quantity));
        }
      } catch {
        // The cart drawer fires this without awaiting, so surface the
        // failure here rather than leaving an unhandled rejection
        toast.error(t('cart.updateError'));
      }
    },
    [isAuthenticated, t],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      try {
        if (isAuthenticated) {
          // The server answers 204, so drop the item locally instead of
          // reading a body that is not there
          await api.delete(`/cart/${itemId}`);
          setItems((prev) => prev.filter((item) => item.id !== itemId));
        } else {
          setItems(removeGuestCartItem(itemId));
        }
      } catch {
        toast.error(t('cart.updateError'));
      }
    },
    [isAuthenticated, t],
  );

  const clearCart = useCallback(async () => {
    try {
      if (isAuthenticated) {
        await api.delete('/cart');
      } else {
        clearGuestCart();
      }
    } catch {
      // Post-payment cleanup must never block the confirmation step; a
      // failed server clear re-syncs on the next cart fetch
    }
    setItems([]);
  }, [isAuthenticated]);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        total,
        isLoading: authLoading || isLoading || loadedFor !== owner,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart: fetchCart,
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
