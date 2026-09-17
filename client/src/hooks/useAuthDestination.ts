import { useLocation } from 'react-router-dom';

/** Restore a protected route after login, restricting navigation to this origin. */
export function useAuthDestination(): string {
  const { state } = useLocation();
  const from = state?.from;
  if (!from || typeof from.pathname !== 'string' || !from.pathname.startsWith('/') || from.pathname.startsWith('//') || from.pathname.includes('\\')) return '/';
  const destination = new URL(from.pathname, window.location.origin);
  if (destination.origin !== window.location.origin || ['/signin', '/signup'].includes(destination.pathname)) return '/';
  if (typeof from.search === 'string' && from.search.startsWith('?')) destination.search = from.search;
  if (typeof from.hash === 'string' && from.hash.startsWith('#')) destination.hash = from.hash;
  return destination.pathname + destination.search + destination.hash;
}
