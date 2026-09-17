const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/* ── Token helpers ── */

let accessToken: string | null = null;
let sessionGeneration = 0;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  sessionGeneration += 1;
}

export function clearTokens(): void {
  accessToken = null;
  sessionGeneration += 1;
}

export async function settleSessionRefresh(): Promise<void> {
  await refreshPromise;
}

export type RequestOptions = Pick<RequestInit, 'signal'>;

/* ── Internal fetch wrapper ── */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function isAuthPath(path: string): boolean {
  return path.startsWith('/auth/');
}

async function attemptTokenRefresh(): Promise<boolean> {
  const generation = sessionGeneration;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (generation !== sessionGeneration) return false;
    if (!res.ok) {
      clearTokens();
      return false;
    }

    const body = await res.json();
    if (generation !== sessionGeneration) return false;
    setAccessToken(body.data.tokens.accessToken);
    return true;
  } catch {
    if (generation === sessionGeneration) clearTokens();
    return false;
  }
}

export async function refreshSession(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    if (navigator.locks) return await navigator.locks.request('blessp-refresh', attemptTokenRefresh);
    return attemptTokenRefresh();
  })().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    signal: options.signal,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  if (isAuthPath(path)) {
    fetchOptions.credentials = 'include';
  }

  let res = await fetch(`${BASE_URL}${path}`, fetchOptions);

  // Automatic token refresh on 401
  if (res.status === 401 && (!isAuthPath(path) || path === '/auth/me')) {
    options.signal?.throwIfAborted();
    const refreshed = await refreshSession();
    options.signal?.throwIfAborted();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      res = await fetch(`${BASE_URL}${path}`, {
        signal: options.signal,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        ...(isAuthPath(path) ? { credentials: 'include' as RequestCredentials } : {}),
      });
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'An unexpected error occurred.' },
    }));
    throw errorBody.error || errorBody;
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

/**
 * Same as request() but returns the full JSON envelope without unwrapping.
 * Useful for paginated endpoints where the response includes pagination metadata.
 */
async function requestRaw<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    signal: options.signal,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  if (isAuthPath(path)) {
    fetchOptions.credentials = 'include';
  }

  let res = await fetch(`${BASE_URL}${path}`, fetchOptions);

  if (res.status === 401 && (!isAuthPath(path) || path === '/auth/me')) {
    options.signal?.throwIfAborted();
    const refreshed = await refreshSession();
    options.signal?.throwIfAborted();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      res = await fetch(`${BASE_URL}${path}`, {
        signal: options.signal,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        ...(isAuthPath(path) ? { credentials: 'include' as RequestCredentials } : {}),
      });
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'An unexpected error occurred.' },
    }));
    throw errorBody.error || errorBody;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

/* ── Public API methods ── */

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  getRaw: <T>(path: string, options?: RequestOptions) => requestRaw<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
