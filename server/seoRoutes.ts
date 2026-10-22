import type { Express, Request } from "express";
import type { Store } from "../drizzle/schema";
import {
  getPublicStoreProduct,
  listPublicStoreProductSitemapEntries,
} from "./db";
import {
  buildGenericSeo,
  buildProductSeo,
  buildStoreSeo,
  injectSeoHead,
  renderRobots,
  renderSitemap,
  type SeoProduct,
} from "./seo";

const PRIVATE_PREFIXES = [
  "/dashboard",
  "/login",
  "/api",
  "/store/cart",
  "/store/checkout",
  "/store/builder",
  "/store/theme",
  "/store/editor",
];

/** Only customer-facing storefront pages receive SEO tags. */
export function isPublicSeoPath(path: string): boolean {
  if (!path || path === "/" || path === "/store" || path === "/store/") return true;
  if (
    PRIVATE_PREFIXES.some(
      prefix => path === prefix || path.startsWith(`${prefix}/`)
    )
  )
    return false;
  return (
    path.startsWith("/p/") ||
    path.startsWith("/b/") ||
    path.startsWith("/store/category/")
  );
}

export function requestOrigin(req: Request): string {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      ?.trim() ||
    req.protocol ||
    "https";
  const hostHeader = (req.headers.host ?? "").toLowerCase();
  const host = /^[a-z0-9.-]+(?::\d+)?$/i.test(hostHeader)
    ? hostHeader
    : process.env.APP_BASE_DOMAIN || "localhost";
  return `${proto}://${host}`;
}

export function requestPath(req: Request): string {
  return (req.originalUrl || req.url || "/").split("?")[0].split("#")[0];
}

/**
 * Inject the store/product head into the first HTML response. Called by both
 * the Vite dev shell and the production static shell, so the behavior is
 * identical (and the dashboard/private routes are untouched).
 */
export async function applySeoToHtml(
  req: Request,
  html: string,
  store: Store | null | undefined
): Promise<string> {
  if (req.method !== "GET" && req.method !== "HEAD") return html;
  const path = requestPath(req);
  if (!isPublicSeoPath(path)) return html;
  const origin = requestOrigin(req);

  try {
    if (store) {
      const productMatch = path.match(/^\/p\/(\d+)\/?$/);
      if (productMatch) {
        const product = await getPublicStoreProduct(
          Number(productMatch[1]),
          store.id
        );
        if (product) {
          return injectSeoHead(
            html,
            buildProductSeo({
              store,
              origin,
              path,
              product: product as unknown as SeoProduct,
            })
          );
        }
      }
      return injectSeoHead(html, buildStoreSeo({ store, origin, path }));
    }
    return injectSeoHead(html, buildGenericSeo({ origin, path }));
  } catch (error) {
    // SEO must never take the storefront down.
    console.warn("[seo] head injection failed:", error);
    return html;
  }
}

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (req, res) => {
    const store = (res.locals.store as Store | null | undefined) ?? null;
    res
      .type("text/plain")
      .set("Cache-Control", "public, max-age=300")
      .send(renderRobots({ store, origin: requestOrigin(req) }));
  });

  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const store = (res.locals.store as Store | null | undefined) ?? null;
      if (!store) {
        res.status(404).type("text/plain").send("Not found");
        return;
      }
      const products = await listPublicStoreProductSitemapEntries(store.id);
      res
        .type("application/xml")
        .set("Cache-Control", "public, max-age=300, s-maxage=3600")
        .send(
          renderSitemap({
            store,
            origin: requestOrigin(req),
            products,
          })
        );
    } catch (error) {
      next(error);
    }
  });
}
