import { useState, useCallback } from 'react';
import type { ApiError } from '@/lib/types';

interface UseApiState<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T | undefined>;
  reset: () => void;
}

export function useApi<T>(
  apiFn: (...args: unknown[]) => Promise<T>,
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | undefined> => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const data = await apiFn(...args);
        setState({ data, error: null, isLoading: false });
        return data;
      } catch (err) {
        const apiError = err as ApiError;
        setState({ data: null, error: apiError, isLoading: false });
        return undefined;
      }
    },
    [apiFn],
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, execute, reset };
}
