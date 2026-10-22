import type { Store } from "../drizzle/schema";

/**
 * Public-storefront SEO helpers.
 *
 * The SPA still renders the body on the client, but crawlers/social bots get
 * correct title/meta/OG/canonical/JSON-LD in the FIRST HTML response. Dashboard
 * and private routes are never touched.
 */

export type SeoModel = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type: "website" | "product";
  siteName: string;
  locale: string;
  robots: string;
  jsonLd: unknown[];
};

export type SeoProduct = {
  id: number;
  title: string;
  description: string;
  price?: string | null;
  currency?: string | null;
  inventory: number;
  trackInventory: boolean;
  continueSelling: boolean;
  sku?: string | null;
  productType?: string | null;
  collectionName?: string | null;
  updatedAt?: Date | string | null;
  images: Array<{ url: string; altText?: string | null }>;
  variants: Array<{
    price?: string | null;
    stock: number;
    available?: boolean;
  }>;
  offers: Array<{ price?: string | null }>;
};

const APP_NAME = "عبده ستور";
const DEFAULT_DESCRIPTION =
  "تسوّق أونلاين مع الدفع عند الاستلام والتوصيل إلى 58 ولاية.";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(value: string): string {
  return escapeHtml(value);
}

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: string, max: number): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function absoluteUrl(origin: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith("/")) return `${origin}${pathOrUrl}`;
  return `${origin}/${pathOrUrl}`;
}

export function canonicalPath(path: string): string {
  const withoutQuery = path.split("?")[0].split("#")[0];
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

export function productPrice(product: SeoProduct): string | null {
  const candidates = [
    product.price,
    product.variants.find(v => v.price)?.price,
    product.offers.find(o => o.price)?.price,
  ];
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value.toFixed(2);
  }
  return null;
}

export function productAvailable(product: SeoProduct): boolean {
  if (!product.trackInventory || product.continueSelling) return true;
  if (product.variants.length) {
    return product.variants.some(
      variant => variant.available !== false && variant.stock > 0
    );
  }
  return product.inventory > 0;
}

function productImages(product: SeoProduct, origin: string): string[] {
  return product.images
    .map(image => image.url?.trim())
    .filter((url): url is string => Boolean(url) && !url.startsWith("data:"))
    .map(url => absoluteUrl(origin, url))
    .slice(0, 6);
}

export function buildStoreSeo(input: {
  store: Pick<Store, "name" | "slug">;
  origin: string;
  path: string;
}): SeoModel {
  const path = canonicalPath(input.path);
  const canonical = absoluteUrl(input.origin, path === "/store" ? "/" : path);
  const title = input.store.name;
  const description = `${input.store.name} — ${DEFAULT_DESCRIPTION}`;
  return {
    title,
    description,
    canonical,
    type: "website",
    siteName: input.store.name,
    locale: "ar_DZ",
    robots: "index,follow",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: input.store.name,
        url: canonical,
        inLanguage: "ar",
      },
    ],
  };
}

export function buildProductSeo(input: {
  store: Pick<Store, "name" | "slug">;
  origin: string;
  path: string;
  product: SeoProduct;
}): SeoModel {
  const { store, origin, product } = input;
  const canonical = absoluteUrl(origin, canonicalPath(input.path));
  const images = productImages(product, origin);
  const image = images[0];
  const price = productPrice(product);
  const available = productAvailable(product);
  const description = truncate(
    stripHtml(product.description) ||
      `${product.title} — ${store.name}. ${DEFAULT_DESCRIPTION}`,
    160
  );
  const title = `${product.title} | ${store.name}`;
  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    sku: product.sku?.trim() || `P-${product.id}`,
    ...(images.length ? { image: images } : {}),
    ...(product.productType || product.collectionName
      ? { category: product.productType || product.collectionName }
      : {}),
    brand: { "@type": "Brand", name: store.name },
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            url: canonical,
            priceCurrency: (product.currency || "DZD").toUpperCase(),
            price,
            availability: available
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }
      : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: store.name,
        item: absoluteUrl(origin, "/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.title,
        item: canonical,
      },
    ],
  };
  return {
    title,
    description,
    canonical,
    image,
    type: "product",
    siteName: store.name,
    locale: "ar_DZ",
    robots: "index,follow",
    jsonLd: [productLd, breadcrumbLd],
  };
}

export function buildGenericSeo(input: {
  origin: string;
  path: string;
}): SeoModel {
  const canonical = absoluteUrl(input.origin, canonicalPath(input.path));
  return {
    title: APP_NAME,
    description: DEFAULT_DESCRIPTION,
    canonical,
    type: "website",
    siteName: APP_NAME,
    locale: "ar_DZ",
    robots: "index,follow",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: APP_NAME,
        url: canonical,
        inLanguage: "ar",
      },
    ],
  };
}

function jsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function renderSeoHead(model: SeoModel): string {
  const tags = [
    `<title>${escapeHtml(model.title)}</title>`,
    `<meta name="description" content="${escapeHtml(model.description)}">`,
    `<link rel="canonical" href="${escapeHtml(model.canonical)}">`,
    `<meta name="robots" content="${escapeHtml(model.robots)}">`,
    `<meta property="og:type" content="${model.type}">`,
    `<meta property="og:site_name" content="${escapeHtml(model.siteName)}">`,
    `<meta property="og:locale" content="${model.locale}">`,
    `<meta property="og:title" content="${escapeHtml(model.title)}">`,
    `<meta property="og:description" content="${escapeHtml(model.description)}">`,
    `<meta property="og:url" content="${escapeHtml(model.canonical)}">`,
    `<meta name="twitter:card" content="${model.image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(model.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(model.description)}">`,
  ];
  if (model.image) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(model.image)}">`,
      `<meta name="twitter:image" content="${escapeHtml(model.image)}">`
    );
  }
  for (const entry of model.jsonLd) {
    tags.push(`<script type="application/ld+json">${jsonForHtml(entry)}</script>`);
  }
  return `<!-- seo:start -->\n${tags.join("\n")}\n<!-- seo:end -->`;
}

/** Replace any previous SEO block and the template title, then inject once. */
export function injectSeoHead(html: string, model: SeoModel): string {
  if (!/<\/head>/i.test(html)) return html;
  const cleaned = html
    .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/gi, "")
    .replace(/<title[^>]*>[\s\S]*?<\/title>/i, "");
  return cleaned.replace(/<\/head>/i, `${renderSeoHead(model)}\n</head>`);
}

/**
 * Private/preview/missing pages keep the shell but must never be indexed.
 * Mirrors the `X-Robots-Tag` header set by the route guard.
 */
export function renderRobotsMeta(content: string): string {
  return `<meta name="robots" content="${escapeHtml(content)}">`;
}

export function injectRobotsMeta(html: string, content: string): string {
  if (!/<\/head>/i.test(html)) return html;
  const cleaned = html
    .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/gi, "")
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, "");
  return cleaned.replace(/<\/head>/i, `${renderRobotsMeta(content)}\n</head>`);
}

export function renderSitemap(input: {
  store: Pick<Store, "name" | "slug">;
  origin: string;
  products: Array<{ id: number; updatedAt?: Date | string | null }>;
}): string {
  const urls = [
    `<url><loc>${escapeXml(absoluteUrl(input.origin, "/"))}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...input.products.map(product => {
      const lastmod = product.updatedAt
        ? `<lastmod>${new Date(product.updatedAt).toISOString()}</lastmod>`
        : "";
      return `<url><loc>${escapeXml(absoluteUrl(input.origin, `/p/${product.id}`))}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

export function renderRobots(input: {
  store?: Pick<Store, "name" | "slug"> | null;
  origin: string;
}): string {
  const lines = ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /dashboard"];
  if (input.store)
    lines.push(`Sitemap: ${absoluteUrl(input.origin, "/sitemap.xml")}`);
  return `${lines.join("\n")}\n`;
}
