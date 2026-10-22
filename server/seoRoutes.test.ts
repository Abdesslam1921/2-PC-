import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { Store } from "../drizzle/schema";
import {
  applySeoToHtml,
  classifySeoPath,
  createSeoGuard,
  isHtmlNavigationPath,
  isPublicSeoPath,
  requestPath,
  seoStateFor,
} from "./seoRoutes";

const store = {
  id: 5,
  ownerId: 1,
  name: "متجر الاختبار",
  slug: "shop",
  language: "dz-ar",
  templateId: null,
  aiStyleConfig: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Store;

const product = {
  id: 7,
  title: "حقيبة",
  description: "<p>وصف</p>",
  price: "4500.00",
  currency: "DZD",
  inventory: 2,
  trackInventory: true,
  continueSelling: false,
  images: [{ url: "/bag.jpg" }],
  variants: [],
  offers: [],
};

function makeReq(path: string, host = "shop.abdou-store.com") {
  return {
    method: "GET",
    headers: { host, "x-forwarded-proto": "https" },
    originalUrl: path,
    url: path,
    protocol: "http",
  } as unknown as Request;
}

function makeRes(storeValue: Store | null = store) {
  const headers: Record<string, string> = {};
  const res: any = {
    locals: { store: storeValue },
    statusCode: 200,
    setHeader(key: string, value: string) {
      headers[key.toLowerCase()] = String(value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  return { res: res as Response, headers };
}

function guardWith(overrides: Record<string, unknown> = {}) {
  return createSeoGuard({
    resolveStore: vi.fn(async () => store),
    getProduct: vi.fn(async (id: number) => (id === 7 ? product : undefined)),
    getBundle: vi.fn(async (slug: string) =>
      slug === "winter" ? { id: 1, slug } : undefined
    ),
    getCategory: vi.fn(async (slug: string) =>
      slug === "bags" ? { id: 1, slug } : undefined
    ),
    ...overrides,
  } as any);
}

describe("SEO route scope", () => {
  it("classifies public entity, private and unknown paths", () => {
    expect(classifySeoPath("/")).toBe("public-store");
    expect(classifySeoPath("/store")).toBe("public-store");
    expect(classifySeoPath("/p/42")).toBe("public-product");
    expect(classifySeoPath("/b/winter")).toBe("public-bundle");
    expect(classifySeoPath("/store/category/shoes")).toBe("public-category");
    expect(classifySeoPath("/store/cart")).toBe("private");
    expect(classifySeoPath("/store/checkout")).toBe("private");
    expect(classifySeoPath("/dashboard")).toBe("private");
    expect(classifySeoPath("/store/editor")).toBe("private");
    expect(classifySeoPath("/store/theme-legacy")).toBe("private");
    expect(classifySeoPath("/funnels/ai/preview/1")).toBe("private");
    expect(classifySeoPath("/random")).toBe("other");
  });

  it("keeps the legacy public-path predicate", () => {
    ["/", "/store", "/p/42", "/b/winter", "/store/category/shoes"].forEach(
      path => expect(isPublicSeoPath(path), path).toBe(true)
    );
    [
      "/dashboard",
      "/login",
      "/api/trpc",
      "/store/cart",
      "/store/checkout",
      "/store/editor",
      "/random",
    ].forEach(path => expect(isPublicSeoPath(path), path).toBe(false));
  });

  it("skips API and asset requests", () => {
    expect(isHtmlNavigationPath("/api/trpc")).toBe(false);
    expect(isHtmlNavigationPath("/manus-storage/a.jpg")).toBe(false);
    expect(isHtmlNavigationPath("/@vite/client")).toBe(false);
    expect(isHtmlNavigationPath("/robots.txt")).toBe(false);
    expect(isHtmlNavigationPath("/sitemap.xml")).toBe(false);
    expect(isHtmlNavigationPath("/p/7")).toBe(true);
  });

  it("builds canonical from configured origin, never from Host/X-Forwarded-Proto", async () => {
    vi.stubEnv("APP_BASE_DOMAIN", "abdou-store.com");
    try {
      const req = {
        method: "GET",
        headers: {
          host: "evil.example.com",
          "x-forwarded-proto": "http",
        },
        originalUrl: "/",
        url: "/",
        protocol: "http",
      } as unknown as Request;
      const { res } = makeRes(store);
      await guardWith()(req, res, vi.fn());

      const html = await applySeoToHtml(
        req,
        "<html><head></head><body></body></html>",
        store
      );
      expect(html).toContain('rel="canonical" href="https://shop.abdou-store.com/"');
      expect(html).toContain('property="og:url" content="https://shop.abdou-store.com/"');
      expect(html).not.toContain("evil.example.com");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses the configured marketing origin when no store is resolved", async () => {
    vi.stubEnv("APP_BASE_DOMAIN", "abdou-store.com");
    try {
      const req = makeReq("/", "abdou-store.com");
      const { res } = makeRes(null);
      await guardWith()(req, res, vi.fn());
      const html = await applySeoToHtml(
        req,
        "<html><head></head><body></body></html>",
        null
      );
      expect(html).toContain('rel="canonical" href="https://abdou-store.com/"');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("strips query/hash from the request path", () => {
    const req = {
      originalUrl: "/p/42?utm=fb#top",
      url: "/p/42?utm=fb#top",
    } as unknown as Request;
    expect(requestPath(req)).toBe("/p/42");
  });
});

describe("SEO route guard", () => {
  it("marks private routes noindex through header and meta", async () => {
    const req = makeReq("/store/cart");
    const { res, headers } = makeRes();
    const next = vi.fn();
    await guardWith()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(seoStateFor(req)?.index).toBe(false);

    const html = await applySeoToHtml(req, "<html><head><title>x</title></head><body></body></html>", store);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain("<title>x</title>");
  });

  it("answers 404 + noindex for an unresolved store host", async () => {
    const resolveStore = vi.fn(async () => null);
    const req = makeReq("/", "missing.abdou-store.com");
    const { res, headers } = makeRes(null);
    const next = vi.fn();
    await guardWith({ resolveStore })(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(seoStateFor(req)?.reason).toBe("store_unresolved");

    // The SPA shell calls res.status(200); the explicit 404 must survive.
    res.status(200);
    expect(res.statusCode).toBe(404);
  });

  it("treats an inactive store exactly like an unresolved host", async () => {
    const resolveStore = vi.fn(async () => null);
    const req = makeReq("/p/7", "inactive.abdou-store.com");
    const { res } = makeRes(null);
    const next = vi.fn();
    await guardWith({ resolveStore })(req, res, next);
    expect(res.statusCode).toBe(404);
    expect(seoStateFor(req)?.index).toBe(false);
  });

  it("answers 503 + noindex when the store lookup fails", async () => {
    const resolveStore = vi.fn(async () => {
      throw new Error("db down");
    });
    const req = makeReq("/", "shop.abdou-store.com");
    const { res, headers } = makeRes(null);
    const next = vi.fn();
    await guardWith({ resolveStore })(req, res, next);

    expect(res.statusCode).toBe(503);
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(seoStateFor(req)?.reason).toBe("store_lookup_failed");
  });

  it("answers 404 + noindex for a missing product", async () => {
    const req = makeReq("/p/999");
    const { res, headers } = makeRes();
    const next = vi.fn();
    await guardWith()(req, res, next);

    expect(res.statusCode).toBe(404);
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(seoStateFor(req)?.reason).toBe("product_not_found");
  });

  it("answers 404 + noindex for a missing bundle and category", async () => {
    const missingBundle = makeReq("/b/nope");
    const bundleRes = makeRes();
    await guardWith()(missingBundle, bundleRes.res, vi.fn());
    expect(bundleRes.res.statusCode).toBe(404);

    const missingCategory = makeReq("/store/category/nope");
    const categoryRes = makeRes();
    await guardWith()(missingCategory, categoryRes.res, vi.fn());
    expect(categoryRes.res.statusCode).toBe(404);
  });

  it("keeps existing entities indexable and reuses the resolved product", async () => {
    const req = makeReq("/p/7");
    const { res, headers } = makeRes();
    const next = vi.fn();
    await guardWith()(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(headers["x-robots-tag"]).toBeUndefined();
    const state = seoStateFor(req);
    expect(state?.index).toBe(true);
    expect(state?.product?.title).toBe("حقيبة");

    const html = await applySeoToHtml(
      req,
      "<html><head><title>base</title></head><body></body></html>",
      store
    );
    expect(html).toContain("حقيبة");
    expect(html).toContain('rel="canonical"');
    expect(html).not.toContain("noindex");
  });

  it("keeps the main domain indexable when no store is involved", async () => {
    const req = makeReq("/", "abdou-store.com");
    const { res } = makeRes(null);
    const next = vi.fn();
    await guardWith()(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(seoStateFor(req)?.index).toBe(true);
    const html = await applySeoToHtml(
      req,
      "<html><head></head><body></body></html>",
      null
    );
    expect(html).toContain("عبده ستور");
  });
});
