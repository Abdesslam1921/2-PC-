import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSlugFromHostname } from "./_core/stores";

const storesSource = readFileSync(
  path.join(process.cwd(), "server", "_core", "stores.ts"),
  "utf8"
);

describe("public store resolution", () => {
  it("resolves subdomains of the configured base domain only", () => {
    expect(getSlugFromHostname("shop.abdou-store.com")).toBe("shop");
    expect(getSlugFromHostname("SHOP.Abdou-Store.com:443")).toBe("shop");
    expect(getSlugFromHostname("abdou-store.com")).toBeNull();
    expect(getSlugFromHostname("www.abdou-store.com")).toBeNull();
    expect(getSlugFromHostname("localhost")).toBeNull();
    expect(getSlugFromHostname("a.b.abdou-store.com")).toBeNull();
  });

  it("requires an active store for public host resolution", () => {
    const fn = storesSource.slice(
      storesSource.indexOf("export async function resolveStoreBySlug"),
      storesSource.indexOf("export async function resolveStoreByRequest")
    );
    expect(fn).toContain("eq(stores.slug, slug)");
    expect(fn).toContain("eq(stores.isActive, true)");
  });

  it("keeps the owner dashboard independent from isActive", () => {
    const fn = storesSource.slice(
      storesSource.indexOf("export async function getActiveStoreForUser")
    );
    expect(fn).toContain("listStoresForOwner");
    expect(fn).not.toContain("isActive");
  });
});
