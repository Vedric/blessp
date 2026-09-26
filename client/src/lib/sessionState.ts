const LOGOUT_KEY = 'blessp_session_logout';
type LogoutState = 'pending' | 'complete' | null;
let memoryState: LogoutState = null;

function parse(value: string | null): LogoutState {
  return value === 'pending' || value === 'complete' ? value : null;
}

export function getLogoutState(): LogoutState {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const state = parse(window[name].getItem(LOGOUT_KEY));
      if (state) return state;
    } catch { /* Keep the in-memory intent when browser storage is unavailable. */ }
  }
  return memoryState;
}

export function setLogoutState(state: LogoutState): void {
  memoryState = state;
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      if (state) window[name].setItem(LOGOUT_KEY, state);
      else window[name].removeItem(LOGOUT_KEY);
    } catch { /* One storage area may remain available when the other is full. */ }
  }
}

export function subscribeToLogoutIntent(onLogout: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== LOGOUT_KEY) return;
    memoryState = parse(event.newValue);
    // Mirror other tabs' intent into this tab's fallback without rebroadcasting it.
    try {
      if (memoryState) sessionStorage.setItem(LOGOUT_KEY, memoryState);
      else sessionStorage.removeItem(LOGOUT_KEY);
    } catch { /* The shared intent is still available in memory. */ }
    if (memoryState) onLogout();
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
