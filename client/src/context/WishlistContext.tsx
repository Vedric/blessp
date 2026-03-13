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
import type { WishlistItem } from '@/lib/types';

interface WishlistState {
  wishlistItems: WishlistItem[];
  wishlistCount: number;
  isLoading: boolean;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistState | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const wishlistCount = wishlistItems.length;

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.get<WishlistItem[]>('/wishlist');
      setWishlistItems(data);
    } catch {
      setWishlistItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const isInWishlist = useCallback(
    (productId: string) => wishlistItems.some((item) => item.productId === productId),
    [wishlistItems],
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const result = await api.post<{ added: boolean; item: WishlistItem | null }>('/wishlist', {
        productId,
      });

      if (result.added && result.item) {
        setWishlistItems((prev) => [result.item!, ...prev]);
      } else {
        setWishlistItems((prev) => prev.filter((item) => item.productId !== productId));
      }
    },
    [],
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistCount,
        isLoading,
        isInWishlist,
        toggleWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return ctx;
}
