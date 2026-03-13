import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';

const MAX_COMPARE_ITEMS = 3;
const STORAGE_KEY = 'compare_product_ids';

interface CompareState {
  compareIds: string[];
  addToCompare: (productId: string) => void;
  removeFromCompare: (productId: string) => void;
  isInCompare: (productId: string) => boolean;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareState | undefined>(undefined);

function getStoredIds(): string[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_COMPARE_ITEMS);
      }
    }
  } catch {
    // sessionStorage may be unavailable in some environments
  }
  return [];
}

function persistIds(ids: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Silently ignore storage errors
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareIds, setCompareIds] = useState<string[]>(getStoredIds);

  useEffect(() => {
    persistIds(compareIds);
  }, [compareIds]);

  const addToCompare = useCallback((productId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(productId)) return prev;
      if (prev.length >= MAX_COMPARE_ITEMS) {
        toast('You can compare up to 3 products at a time.', {
          icon: '\u26A0\uFE0F',
        });
        return prev;
      }
      return [...prev, productId];
    });
  }, []);

  const removeFromCompare = useCallback((productId: string) => {
    setCompareIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  const isInCompare = useCallback(
    (productId: string) => compareIds.includes(productId),
    [compareIds],
  );

  const clearCompare = useCallback(() => {
    setCompareIds([]);
  }, []);

  return (
    <CompareContext.Provider
      value={{
        compareIds,
        addToCompare,
        removeFromCompare,
        isInCompare,
        clearCompare,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareState {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return ctx;
}
