const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/* ── Token helpers ── */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearTokens(): void {
  accessToken = null;
}

/* ── Internal fetch wrapper ── */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function isAuthPath(path: string): boolean {
  return path.startsWith('/auth/');
}

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const body = await res.json();
    setAccessToken(body.data.tokens.accessToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function refreshIfNeeded(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = attemptTokenRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  if (isAuthPath(path)) {
    fetchOptions.credentials = 'include';
  }

  let res = await fetch(`${BASE_URL}${path}`, fetchOptions);

  // Automatic token refresh on 401
  if (res.status === 401) {
    const refreshed = await refreshIfNeeded();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      res = await fetch(`${BASE_URL}${path}`, {
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
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  if (isAuthPath(path)) {
    fetchOptions.credentials = 'include';
  }

  let res = await fetch(`${BASE_URL}${path}`, fetchOptions);

  if (res.status === 401) {
    const refreshed = await refreshIfNeeded();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      res = await fetch(`${BASE_URL}${path}`, {
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
  get: <T>(path: string) => request<T>('GET', path),
  getRaw: <T>(path: string) => requestRaw<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
