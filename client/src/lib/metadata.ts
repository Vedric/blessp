export const SITE_TITLE = 'BLE$$ P — Luxury Streetwear';
export const SITE_DESCRIPTION = 'BLE$$ P is luxury streetwear crafted for intention. Hoodies, tracksuits and limited editions, designed and produced with meticulous care.';

export function siteOrigin(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="blessp:origin"]')?.content || window.location.origin;
}

export function setMeta(key: string, content: string, property = false): void {
  const attribute = property ? 'property' : 'name';
  let element = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function setPageMetadata(title = SITE_TITLE, description = SITE_DESCRIPTION, image?: string, price?: number): void {
  document.title = title;
  let imageUrl = new URL('/img/blessp_story.jpeg', siteOrigin()).href;
  try {
    const candidate = new URL(image || imageUrl, siteOrigin());
    if (['http:', 'https:'].includes(candidate.protocol)) imageUrl = candidate.href;
  } catch { /* Legacy malformed images use the storefront fallback. */ }
  setMeta('description', description);
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  setMeta('og:image', imageUrl, true);
  setMeta('og:type', price === undefined ? 'website' : 'product', true);
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', imageUrl);
  if (price !== undefined) {
    setMeta('product:price:amount', (price / 100).toFixed(2), true);
    setMeta('product:price:currency', 'CAD', true);
  } else {
    document.querySelectorAll('meta[property^="product:price:"]').forEach((element) => element.remove());
  }
}
