import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { Env } from '../config/env';
import { prisma } from '../database/client';
import { escapeHtml } from '../email/html';

const BRAND = 'BLE$$ P';
const DESCRIPTION = 'BLE$$ P is luxury streetwear crafted for intention. Hoodies, tracksuits and limited editions, designed and produced with meticulous care.';
const HERO_IMAGE = '/img/blessp_story.jpeg';
const PAGE_SIZE = 1000;
const PRODUCT_ID = /^\/products\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i;
const PUBLIC_PAGES: Record<string, string> = {
  '/': `${BRAND} — Luxury Streetwear`,
  '/shop': `Collection — ${BRAND}`,
  '/contact': `Contact — ${BRAND}`,
  '/terms': `Terms & Conditions — ${BRAND}`,
  '/return-policy': `Shipping & Returns — ${BRAND}`,
  '/privacy': `Privacy Policy — ${BRAND}`,
  '/legal-notice': `Legal Notice — ${BRAND}`,
};
const PRIVATE_PAGE = /^\/(?:signin|signup|forgot-password|reset-password|verify-email|checkout|order-status|newsletter\/confirm|search|compare|wishlist|profile(?:\/(?:orders(?:\/[^/]+)?|addresses|loyalty|payment-methods|email-preferences))?|admin(?:\/(?:products(?:\/(?:new|[^/]+\/edit))?|orders|reviews|inventory|contact))?)\/?$/;

function absoluteUrl(value: string, origin: string): string | undefined {
  try {
    const url = new URL(value, origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function xmlLocation(url: string, updatedAt?: Date): string {
  return `<url><loc>${escapeHtml(url)}</loc>${updatedAt ? `<lastmod>${updatedAt.toISOString()}</lastmod>` : ''}</url>`;
}

function xmlDocument(body: string, index = false): string {
  const tag = index ? 'sitemapindex' : 'urlset';
  return `<?xml version="1.0" encoding="UTF-8"?><${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</${tag}>`;
}

/** Same HTML metadata for users and crawlers, from the authoritative public catalogue. */
export function storefrontRouter(publicPath: string): Router {
  const router = Router();
  // Never derive canonical URLs from an untrusted Host or forwarded header.
  const origin = new URL(Env.CLIENT_URL).origin;
  const file = path.join(publicPath, 'index.html');
  const template = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const active = { isActive: true, deletedAt: null };

  router.get('/index.html', (_req, res) => { res.redirect(308, '/'); });

  router.get('/robots.txt', (_req, res) => {
    res.type('text/plain').set('Cache-Control', 'public, max-age=300').send(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /metrics\nDisallow: /health/\nSitemap: ${origin}/sitemap.xml\n`,
    );
  });

  router.get('/sitemap.xml', async (_req, res) => {
    const count = await prisma.product.count({ where: active });
    const pages = Math.ceil(count / PAGE_SIZE);
    const locations = [`${origin}/sitemaps/pages.xml`, ...Array.from({ length: pages }, (_, i) => `${origin}/sitemaps/products-${i + 1}.xml`)];
    res.type('application/xml').set('Cache-Control', 'no-cache').send(xmlDocument(
      locations.map((url) => `<sitemap><loc>${escapeHtml(url)}</loc></sitemap>`).join(''), true,
    ));
  });

  router.get('/sitemaps/pages.xml', (_req, res) => {
    res.type('application/xml').set('Cache-Control', 'no-cache').send(
      xmlDocument(Object.keys(PUBLIC_PAGES).map((url) => xmlLocation(origin + url)).join('')),
    );
  });

  router.get(/^\/sitemaps\/products-([1-9]\d*)\.xml$/, async (req, res) => {
    const page = Number(req.params[0]);
    if (!Number.isSafeInteger(page) || page > 50000) { res.sendStatus(404); return; }
    const products = await prisma.product.findMany({
      where: active, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' },
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    });
    if (!products.length) { res.sendStatus(404); return; }
    res.type('application/xml').set('Cache-Control', 'no-cache').send(xmlDocument(
      products.map((product) => xmlLocation(`${origin}/products/${product.id}`, product.updatedAt)).join(''),
    ));
  });

  router.use(async (req, res, next) => {
    if (!template || !['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api/') || req.path.startsWith('/health/') || req.path === '/metrics' || req.path.includes('.')) {
      next(); return;
    }
    const pathname = req.path.replace(/\/$/, '') || '/';
    const match = pathname.match(PRODUCT_ID);
    let title = PUBLIC_PAGES[pathname] ?? `Page not found — ${BRAND}`;
    let description = DESCRIPTION;
    let image = origin + HERO_IMAGE;
    let status = PUBLIC_PAGES[pathname] || PRIVATE_PAGE.test(pathname) ? 200 : 404;
    let indexable = Boolean(PUBLIC_PAGES[pathname]);
    let productPrice: string | undefined;

    if (match) {
      const product = await prisma.product.findFirst({
        where: { id: match[1], ...active },
        select: { name: true, description: true, picture: true, images: true, price: true },
      });
      if (product) {
        status = 200; indexable = true;
        title = `${product.name} — ${BRAND}`;
        description = (product.description || product.name).replace(/\s+/g, ' ').slice(0, 180);
        image = absoluteUrl(product.picture || product.images[0] || HERO_IMAGE, origin) ?? image;
        productPrice = (product.price / 100).toFixed(2);
      }
    } else if (status === 200 && !indexable) {
      title = `Your account and shopping — ${BRAND}`;
    }

    // Search/filter URLs are not separate landing pages. Keep paginated shop
    // pages self-canonical; strip marketing and all other query parameters.
    const canonical = new URL(origin + pathname);
    if (pathname === '/shop' && typeof req.query.page === 'string' && /^[1-9]\d{0,4}$/.test(req.query.page) && Number(req.query.page) > 1) canonical.searchParams.set('page', req.query.page);
    if (pathname === '/shop' && Object.keys(req.query).some((key) => !['page', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key))) indexable = false;
    const robots = indexable ? 'index, follow' : 'noindex, follow';
    const metadata = [
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeHtml(description)}">`,
      `<meta name="robots" content="${robots}">`,
      `<link rel="canonical" href="${escapeHtml(canonical.href)}">`,
      `<meta name="blessp:origin" content="${escapeHtml(origin)}">`,
      `<meta property="og:type" content="${productPrice ? 'product' : 'website'}">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(description)}">`,
      `<meta property="og:url" content="${escapeHtml(canonical.href)}">`,
      `<meta property="og:image" content="${escapeHtml(image)}">`,
      `<meta name="twitter:title" content="${escapeHtml(title)}">`,
      `<meta name="twitter:description" content="${escapeHtml(description)}">`,
      `<meta name="twitter:image" content="${escapeHtml(image)}">`,
      ...(productPrice ? [`<meta property="product:price:amount" content="${productPrice}">`, '<meta property="product:price:currency" content="CAD">'] : []),
    ].join('\n');
    const html = template
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\b[^>]*(?:name|property)="(?:description|robots|og:(?:type|title|description|url|image(?::width|:height)?)|twitter:(?:title|description|image))"[^>]*>/gi, '')
      .replace('</head>', () => `${metadata}\n</head>`);
    res.status(status).set('Cache-Control', 'no-cache').set('X-Robots-Tag', robots).type('html').send(html);
  });
  return router;
}
