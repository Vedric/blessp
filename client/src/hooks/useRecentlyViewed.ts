import { useState, useCallback } from 'react';

const STORAGE_KEY = 'recentlyViewed';
const MAX_ITEMS = 10;

function readFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

export function useRecentlyViewed() {
  const [recentIds, setRecentIds] = useState<string[]>(readFromStorage);

  const addProduct = useCallback((productId: string) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== productId);
      const updated = [productId, ...filtered].slice(0, MAX_ITEMS);
      writeToStorage(updated);
      return updated;
    });
  }, []);

  const getRecentIds = useCallback((): string[] => {
    return recentIds;
  }, [recentIds]);

  const clearRecent = useCallback(() => {
    setRecentIds([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recentIds, addProduct, getRecentIds, clearRecent };
}
