import type { Express, Request, Response } from "express";
import type { Store } from "../drizzle/schema";
import {
  getPublicCategoryBySlug,
  getPublicOfferBySlug,
  getPublicStoreProduct,
  listPublicStoreProductSitemapEntries,
} from "./db";
import { getSlugFromHostname, resolveStoreBySlug } from "./_core/stores";
import {
  buildGenericSeo,
  buildProductSeo,
  buildStoreSeo,
  injectRobotsMeta,
  injectSeoHead,
  renderRobots,
  renderSitemap,
  type SeoProduct,
} from "./seo";

/**
 * Server-side SEO for the customer-facing storefront.
 *
 * One guard classifies every HTML navigation before the SPA shell is served:
 *  - public entity pages get indexable metadata (built from DB, tenant-scoped),
 *  - private/preview pages get `noindex` through both the header and the meta,
 *  - missing entities and unresolved store hosts answer 404 + noindex.
 *
 * The guard stores its decision on the request (WeakMap), so the HTML
 * injector can reuse the already-resolved entity without a second DB round.
 */

export type SeoRouteKind =
  | "public-store"
  | "public-product"
  | "public-bundle"
  | "public-category"
  | "private"
  | "other";

export type SeoRouteState = {
  kind: SeoRouteKind;
  index: boolean;
  status?: number;
  reason?: string;
  store: Store | null;
  product?: SeoProduct | null;
  bundle?: unknown;
  category?: unknown;
};

const routeStates = new WeakMap<Request, SeoRouteState>();

export function seoStateFor(req: Request): SeoRouteState | null {
  return routeStates.get(req) ?? null;
}

/** Routes that must never be indexed (dashboard, cart, checkout, editors…). */
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/login",
  "/categories",
  "/offers",
  "/products",
  "/profitability",
  "/media-buying",
  "/ai-analytics",
  "/for-ship",
  "/digital-products",
  "/delivery",
  "/connecteurs",
  "/call-center",
  "/funnels",
  "/orders",
  "/customers",
  "/settings",
  "/stores",
  "/templates",
  "/store/cart",
  "/store/checkout",
  "/store/editor",
  "/store/builder",
  "/store/builder-legacy",
  "/store/theme",
  "/store/theme-legacy",
] as const;

/** Static/API requests never receive SEO classification. */
const NON_HTML_PREFIXES = [
  "/api",
  "/manus-storage",
  "/__manus__",
  "/assets",
  "/static",
  "/@",
  "/src/",
  "/node_modules/",
] as const;

export function classifySeoPath(path: string): SeoRouteKind {
  if (!path || path === "/" || path === "/store" || path === "/store/")
    return "public-store";
  if (
    PRIVATE_PREFIXES.some(
      prefix => path === prefix || path.startsWith(`${prefix}/`)
    )
  )
    return "private";
  if (/^\/p\/\d+\/?$/.test(path)) return "public-product";
  if (/^\/b\/[^/]+\/?$/.test(path)) return "public-bundle";
  if (/^\/store\/category\/[^/]+\/?$/.test(path)) return "public-category";
  return "other";
}

/** Only customer-facing storefront paths may receive indexable metadata. */
export function isPublicSeoPath(path: string): boolean {
  const kind = classifySeoPath(path);
  return kind !== "private" && kind !== "other";
}

export function isHtmlNavigationPath(path: string): boolean {
  if (!path) return false;
  if (path === "/robots.txt" || path === "/sitemap.xml") return false;
  if (NON_HTML_PREFIXES.some(prefix => path.startsWith(prefix))) return false;
  // Any request with a file extension (js/css/image/font) is an asset.
  if (/\.[a-z0-9]{1,10}$/i.test(path)) return false;
  return true;
}

export function requestPath(req: Request): string {
  return (req.originalUrl || req.url || "/").split("?")[0].split("#")[0];
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

/** Keep the explicit 404/503 while the SPA shell still answers 200. */
export function lockResponseStatus(res: Response, status: number): void {
  res.statusCode = status;
  res.locals.seoLockedStatus = status;
  if (res.locals.seoStatusLocked) return;
  const originalStatus = res.status.bind(res);
  res.status = function lockedStatus(code: number) {
    if (res.locals.seoLockedStatus) {
      res.statusCode = res.locals.seoLockedStatus;
      return res;
    }
    return originalStatus(code);
  } as Response["status"];
  res.locals.seoStatusLocked = true;
}

function markNoindex(res: Response): void {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

function decide(
  req: Request,
  state: SeoRouteState,
  res?: Response
): void {
  routeStates.set(req, state);
  if (!state.index && res) markNoindex(res);
}

export type SeoGuardDeps = {
  resolveStore: (slug: string) => Promise<Store | null>;
  getProduct: (
    id: number,
    storeId: number
  ) => Promise<unknown | undefined>;
  getBundle: (
    slug: string,
    storeId: number
  ) => Promise<unknown | undefined>;
  getCategory: (
    slug: string,
    storeId: number
  ) => Promise<unknown | undefined>;
};

const defaultDeps: SeoGuardDeps = {
  resolveStore: resolveStoreBySlug,
  getProduct: getPublicStoreProduct,
  getBundle: getPublicOfferBySlug,
  getCategory: getPublicCategoryBySlug,
};

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Express guard. Registered before the SPA shell so both the HTTP status and
 * the `X-Robots-Tag` header are authoritative for crawlers.
 */
export function createSeoGuard(overrides: Partial<SeoGuardDeps> = {}) {
  const deps: SeoGuardDeps = { ...defaultDeps, ...overrides };

  return async function seoGuard(
    req: Request,
    res: Response,
    next: (error?: unknown) => void
  ): Promise<void> {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      const path = requestPath(req);
      if (!isHtmlNavigationPath(path)) return next();

      let store = (res.locals.store as Store | null | undefined) ?? null;
      const kind = classifySeoPath(path);

      if (kind === "private" || kind === "other") {
        decide(req, { kind, index: false, store, reason: kind }, res);
        return next();
      }

      // A store hostname that did not resolve is either inactive or a database
      // failure. Both must never serve indexable generic metadata.
      const hostSlug = getSlugFromHostname(req.headers.host ?? "");
      if (!store && hostSlug) {
        let resolved: Store | null = null;
        try {
          resolved = await deps.resolveStore(hostSlug);
        } catch {
          lockResponseStatus(res, 503);
          decide(
            req,
            { kind, index: false, store: null, reason: "store_lookup_failed" },
            res
          );
          return next();
        }
        if (!resolved) {
          lockResponseStatus(res, 404);
          decide(
            req,
            { kind, index: false, store: null, reason: "store_unresolved" },
            res
          );
          return next();
        }
        store = resolved;
      }

      if (kind === "public-store") {
        decide(req, { kind, index: true, store }, res);
        return next();
      }

      if (!store) {
        lockResponseStatus(res, 404);
        decide(req, { kind, index: false, store: null, reason: "no_store" }, res);
        return next();
      }

      if (kind === "public-product") {
        const id = Number(path.match(/^\/p\/(\d+)/)?.[1]);
        const product = Number.isSafeInteger(id)
          ? await deps.getProduct(id, store.id)
          : undefined;
        if (!product) {
          lockResponseStatus(res, 404);
          decide(
            req,
            { kind, index: false, store, reason: "product_not_found" },
            res
          );
          return next();
        }
        decide(
          req,
          { kind, index: true, store, product: product as SeoProduct },
          res
        );
        return next();
      }

      if (kind === "public-bundle") {
        const raw = path.match(/^\/b\/([^/]+)/)?.[1] ?? "";
        const slug = safeDecode(raw);
        const bundle = slug ? await deps.getBundle(slug, store.id) : undefined;
        if (!bundle) {
          lockResponseStatus(res, 404);
          decide(
            req,
            { kind, index: false, store, reason: "bundle_not_found" },
            res
          );
          return next();
        }
        decide(req, { kind, index: true, store, bundle }, res);
        return next();
      }

      // public-category
      const raw = path.match(/^\/store\/category\/([^/]+)/)?.[1] ?? "";
      const slug = safeDecode(raw);
      const category = slug ? await deps.getCategory(slug, store.id) : undefined;
      if (!category) {
        lockResponseStatus(res, 404);
        decide(
          req,
          { kind, index: false, store, reason: "category_not_found" },
          res
        );
        return next();
      }
      decide(req, { kind, index: true, store, category }, res);
      return next();
    } catch (error) {
      // SEO must never take the storefront down.
      console.warn("[seo] route guard failed:", error);
      lockResponseStatus(res, 503);
      decide(
        req,
        { kind: "other", index: false, store: null, reason: "guard_error" },
        res
      );
      return next();
    }
  };
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
  const state = seoStateFor(req);

  // Private, preview, missing-entity and unresolved-host responses keep their
  // title but must never be indexed.
  if (state && (!state.index || state.status)) {
    return injectRobotsMeta(html, "noindex, nofollow");
  }

  if (state?.index) {
    const resolvedStore = state.store ?? store ?? null;
    if (state.kind === "public-product" && state.product && resolvedStore) {
      return injectSeoHead(
        html,
        buildProductSeo({
          store: resolvedStore,
          origin: requestOrigin(req),
          path,
          product: state.product,
        })
      );
    }
    if (resolvedStore) {
      return injectSeoHead(
        html,
        buildStoreSeo({ store: resolvedStore, origin: requestOrigin(req), path })
      );
    }
    return injectSeoHead(html, buildGenericSeo({ origin: requestOrigin(req), path }));
  }

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
  app.use(createSeoGuard());

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
