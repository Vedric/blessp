import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setMeta, siteOrigin } from '@/lib/metadata';

const publicPages = new Set(['/', '/shop', '/contact', '/terms', '/return-policy', '/privacy', '/legal-notice']);

export function RouteMetadata() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    const route = pathname.replace(/\/$/, '') || '/';
    const canonical = new URL(siteOrigin() + route);
    const query = new URLSearchParams(search);
    const page = query.get('page');
    if (route === '/shop' && page && /^[1-9]\d{0,4}$/.test(page) && Number(page) > 1) canonical.searchParams.set('page', page);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = canonical.href;
    setMeta('og:url', canonical.href, true);
    const filtered = route === '/shop' && [...query.keys()].some(key => !['page', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key));
    const product = /^\/products\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(route);
    setMeta('robots', (publicPages.has(route) || product) && !filtered ? 'index, follow' : 'noindex, follow');
  }, [pathname, search]);
  return null;
}
