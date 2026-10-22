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

export type SeoBundleItem = {
  title: string;
  quantity: number;
  imageUrl?: string | null;
  currency?: string | null;
};

export type SeoBundle = {
  name: string;
  slug: string;
  imageUrl?: string | null;
  updatedAt?: Date | string | null;
  pricing: {
    bundlePrice: number;
    originalTotal: number;
    freeDelivery: boolean;
  };
  items: SeoBundleItem[];
};

export type SeoCategoryPage = {
  category: {
    name: string;
    slug: string;
    imageUrl?: string | null;
    updatedAt?: Date | string | null;
  };
  products: Array<{
    id: number;
    title: string;
    price?: string | number | null;
    images?: Array<{ url: string }>;
  }>;
};

function firstImageUrl(
  images: Array<{ url?: string | null }> | undefined,
  origin: string
): string | undefined {
  for (const image of images ?? []) {
    const url = image.url?.trim();
    if (url && !url.startsWith("data:")) return absoluteUrl(origin, url);
  }
  return undefined;
}

function money(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(value, 0).toFixed(2);
}

/** /b/:slug — bundle page metadata + Product/Breadcrumb JSON-LD. */
export function buildBundleSeo(input: {
  store: Pick<Store, "name" | "slug">;
  origin: string;
  path: string;
  bundle: SeoBundle;
}): SeoModel {
  const { store, origin, bundle } = input;
  const canonical = absoluteUrl(origin, canonicalPath(input.path));
  const images = [
    bundle.imageUrl?.trim(),
    ...bundle.items.map(item => item.imageUrl?.trim()),
  ].filter(
    (url): url is string =>
      typeof url === "string" && url.length > 0 && !url.startsWith("data:")
  );
  const image = images[0] ? absoluteUrl(origin, images[0]) : undefined;
  const price =
    bundle.pricing?.bundlePrice > 0 ? money(bundle.pricing.bundlePrice) : null;
  const currency =
    bundle.items.find(item => item.currency)?.currency?.toUpperCase() || "DZD";
  const itemCount = bundle.items.length;
  const description = truncate(
    `باقة ${bundle.name} من ${store.name}: ${itemCount} منتجات` +
      (price ? ` بسعر ${price} ${currency}` : "") +
      (bundle.pricing?.freeDelivery ? " مع توصيل مجاني." : "."),
    160
  );
  const title = `${bundle.name} | ${store.name}`;
  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bundle.name,
    description,
    sku: `B-${bundle.slug}`,
    url: canonical,
    ...(image ? { image: [image] } : {}),
    brand: { "@type": "Brand", name: store.name },
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            url: canonical,
            priceCurrency: currency,
            price,
            availability: "https://schema.org/InStock",
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
      { "@type": "ListItem", position: 2, name: bundle.name, item: canonical },
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

/** /store/category/:slug — category metadata + CollectionPage/ItemList JSON-LD. */
export function buildCategorySeo(input: {
  store: Pick<Store, "name" | "slug">;
  origin: string;
  path: string;
  categoryPage: SeoCategoryPage;
}): SeoModel {
  const { store, origin, categoryPage } = input;
  const { category, products } = categoryPage;
  const canonical = absoluteUrl(origin, canonicalPath(input.path));
  const image =
    (category.imageUrl?.trim()
      ? absoluteUrl(origin, category.imageUrl.trim())
      : undefined) ?? firstImageUrl(products[0]?.images, origin);
  const description = truncate(
    `${category.name} من ${store.name}: ${products.length} منتجات متاحة للطلب مع الدفع عند الاستلام.`,
    160
  );
  const title = `${category.name} | ${store.name}`;
  const collectionLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description,
    url: canonical,
    ...(image ? { image } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: store.name,
      url: absoluteUrl(origin, "/"),
    },
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: products.length,
    itemListElement: products.slice(0, 30).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.title,
      url: absoluteUrl(origin, `/p/${product.id}`),
    })),
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
        name: category.name,
        item: canonical,
      },
    ],
  };
  return {
    title,
    description,
    canonical,
    image,
    type: "website",
    siteName: store.name,
    locale: "ar_DZ",
    robots: "index,follow",
    jsonLd: [collectionLd, itemListLd, breadcrumbLd],
  };
}

export function buildGenericSeo(input: {
  origin: string;
  path: string;
}): SeoModel {  const canonical = absoluteUrl(input.origin, canonicalPath(input.path));
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
  bundles?: Array<{ slug: string; updatedAt?: Date | string | null }>;
  categories?: Array<{ slug: string; updatedAt?: Date | string | null }>;
}): string {
  const lastmod = (value: Date | string | null | undefined) =>
    value ? `<lastmod>${new Date(value).toISOString()}</lastmod>` : "";
  const urls = [
    `<url><loc>${escapeXml(absoluteUrl(input.origin, "/"))}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...input.products.map(product => {
      return `<url><loc>${escapeXml(absoluteUrl(input.origin, `/p/${product.id}`))}</loc>${lastmod(product.updatedAt)}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }),
    ...(input.bundles ?? []).map(bundle => {
      return `<url><loc>${escapeXml(absoluteUrl(input.origin, `/b/${encodeURIComponent(bundle.slug)}`))}</loc>${lastmod(bundle.updatedAt)}<changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    }),
    ...(input.categories ?? []).map(category => {
      return `<url><loc>${escapeXml(absoluteUrl(input.origin, `/store/category/${encodeURIComponent(category.slug)}`))}</loc>${lastmod(category.updatedAt)}<changefreq>weekly</changefreq><priority>0.6</priority></url>`;
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
