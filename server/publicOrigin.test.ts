import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appBaseDomain,
  mainSiteOrigin,
  normalizeStoreSlug,
  publicOriginForStore,
  storeOrigin,
} from "./publicOrigin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("trusted public origins", () => {
  it("normalises APP_BASE_DOMAIN (scheme, path, trailing dot)", () => {
    vi.stubEnv("APP_BASE_DOMAIN", "https://Abdou-Store.com/");
    expect(appBaseDomain()).toBe("abdou-store.com");
    expect(mainSiteOrigin()).toBe("https://abdou-store.com");
  });

  it("keeps a configured port for local environments", () => {
    vi.stubEnv("APP_BASE_DOMAIN", "localtest.me:3000");
    expect(mainSiteOrigin()).toBe("https://localtest.me:3000");
    expect(storeOrigin({ slug: "shop" })).toBe("https://shop.localtest.me:3000");
  });

  it("falls back to the default domain when the value is unusable", () => {
    vi.stubEnv("APP_BASE_DOMAIN", "javascript:alert(1)");
    expect(appBaseDomain()).toBe("abdou-store.com");
  });

  it("builds https store origins from valid slugs only", () => {
    vi.stubEnv("APP_BASE_DOMAIN", "abdou-store.com");
    expect(storeOrigin({ slug: "shop" })).toBe("https://shop.abdou-store.com");
    expect(storeOrigin({ slug: "SHOP-2" })).toBe(
      "https://shop-2.abdou-store.com"
    );
    expect(storeOrigin({ slug: "../evil" })).toBeNull();
    expect(storeOrigin({ slug: "a.b" })).toBeNull();
    expect(storeOrigin({ slug: "" })).toBeNull();
    expect(storeOrigin(null)).toBeNull();
  });

  it("never derives an origin from request data", () => {
    vi.stubEnv("APP_BASE_DOMAIN", "abdou-store.com");
    expect(normalizeStoreSlug("shop")).toBe("shop");
    expect(publicOriginForStore({ slug: "shop" })).toBe(
      "https://shop.abdou-store.com"
    );
    expect(publicOriginForStore(null)).toBe("https://abdou-store.com");
  });
});
