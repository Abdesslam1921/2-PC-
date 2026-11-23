import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCachedPublicConfig,
  invalidatePublicConfig,
  publicConfigCacheSize,
  setCachedPublicConfig,
} from "./storefrontPublicConfigCache";

describe("storefront public config cache", () => {
  afterEach(() => {
    invalidatePublicConfig();
    vi.useRealTimers();
  });

  it("keeps entries per store and never shares them across tenants", () => {
    setCachedPublicConfig(1, { storeName: "A" });
    setCachedPublicConfig(2, { storeName: "B" });
    expect(getCachedPublicConfig<{ storeName: string }>(1)).toEqual({
      storeName: "A",
    });
    expect(getCachedPublicConfig<{ storeName: string }>(2)).toEqual({
      storeName: "B",
    });
    invalidatePublicConfig(1);
    expect(getCachedPublicConfig(1)).toBeUndefined();
    expect(getCachedPublicConfig<{ storeName: string }>(2)).toEqual({
      storeName: "B",
    });
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    setCachedPublicConfig(7, { ok: true }, 1000);
    expect(getCachedPublicConfig(7)).toEqual({ ok: true });
    vi.advanceTimersByTime(1001);
    expect(getCachedPublicConfig(7)).toBeUndefined();
    expect(publicConfigCacheSize()).toBe(0);
  });
});
