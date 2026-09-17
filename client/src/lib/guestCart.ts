import toast from 'react-hot-toast';
import i18n from '@/i18n';
import { api } from '@/lib/api';
import type { CartItem, CartItemProduct } from '@/lib/types';

/**
 * localStorage-backed cart for unauthenticated visitors. Items use the same
 * CartItem shape the server cart returns so the rest of the app (drawer,
 * checkout, confirmation) renders both carts through one code path.
 *
 * This lives in lib/ rather than in CartContext because AuthContext needs to
 * merge the guest cart on login and CartContext already depends on
 * AuthContext; a shared module keeps the import graph acyclic.
 */

const GUEST_CART_KEY = 'blessp_guest_cart';

// Mirrors the server-side AddToCartSchema cap so a merged cart never fails validation.
const MAX_ITEM_QUANTITY = 99;

export function readGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        !!item &&
        typeof item.id === 'string' &&
        typeof item.productId === 'string' &&
        typeof item.quantity === 'number' &&
        !!item.product,
    );
  } catch {
    // Malformed or inaccessible storage is treated as an empty cart
    return [];
  }
}

function writeGuestCart(items: CartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // localStorage may be unavailable (private browsing quotas); the
    // in-memory copy held by CartContext still works for the current session
  }
}

export function clearGuestCart(): void {
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable
  }
}

export function addGuestCartItem(
  product: CartItemProduct,
  size: string,
  color: string,
  quantity: number,
): CartItem[] {
  const items = readGuestCart();
  const existing = items.find(
    (item) =>
      item.productId === product.id && item.size === size && item.color === color,
  );

  let next: CartItem[];
  if (existing) {
    next = items.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            quantity: Math.min(item.quantity + quantity, MAX_ITEM_QUANTITY),
          }
        : item,
    );
  } else {
    next = [
      ...items,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        quantity: Math.min(quantity, MAX_ITEM_QUANTITY),
        size,
        color,
        // Snapshot only the fields the UI needs so stale extra data never
        // lingers in storage
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          picture: product.picture,
          isActive: product.isActive,
        },
      },
    ];
  }

  writeGuestCart(next);
  return next;
}

export function updateGuestCartItem(itemId: string, quantity: number): CartItem[] {
  const next = readGuestCart().map((item) =>
    item.id === itemId
      ? { ...item, quantity: Math.min(Math.max(quantity, 1), MAX_ITEM_QUANTITY) }
      : item,
  );
  writeGuestCart(next);
  return next;
}

export function removeGuestCartItem(itemId: string): CartItem[] {
  const next = readGuestCart().filter((item) => item.id !== itemId);
  writeGuestCart(next);
  return next;
}

/**
 * Pushes every guest cart item into the authenticated server cart. Called by
 * AuthContext right after a token is issued and before the user state flips,
 * so CartContext's refetch sees the already-merged cart. Never throws: a
 * failed merge must not break the login flow.
 */
export async function mergeGuestCartIntoServerCart(): Promise<void> {
  const items = readGuestCart();
  if (items.length === 0) return;

  let failedCount = 0;
  for (const item of items) {
    try {
      await api.post('/cart', {
        productId: item.productId,
        quantity: item.quantity,
        size: item.size || undefined,
        color: item.color || undefined,
      });
    } catch {
      // Tolerate per-item failures (discontinued product, stock limits);
      // the remaining items still merge
      failedCount += 1;
    }
  }

  // Clear even when some items fail: keeping them would resurrect stale
  // items after logout and re-merge them on every subsequent login
  clearGuestCart();

  if (failedCount > 0) {
    toast.error(i18n.t('cart.mergeError'));
  }
}
