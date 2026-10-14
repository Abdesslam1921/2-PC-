import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

/**
 * Phase 6 / item 1 — explicit cross-tenant isolation tests.
 *
 * These tests pin the FAIL-CLOSED contract of the public and dashboard read
 * paths: without a resolved host store nothing is exposed, and every lookup is
 * scoped by the caller's store so another tenant's id can never resolve.
 * (They exercise the router wiring; the SQL `WHERE storeId = ?` itself is
 * audited statically and covered by the db-layer functions.)
 */
const mocks = vi.hoisted(() => ({
  getPublicStoreProduct: vi.fn(),
  listPublicStoreProducts: vi.fn(),
  getStoreProductById: vi.fn(),
  listPublicCategories: vi.fn(),
  getPublicCategoryBySlug: vi.fn(),
  listPublicProductsByCategory: vi.fn(),
  listPublicOffers: vi.fn(),
  getPublicOfferBySlug: vi.fn(),
}));

vi.mock("../db", () => ({
  getPublicStoreProduct: mocks.getPublicStoreProduct,
  listPublicStoreProducts: mocks.listPublicStoreProducts,
  getStoreProductById: mocks.getStoreProductById,
  listPublicCategories: mocks.listPublicCategories,
  getPublicCategoryBySlug: mocks.getPublicCategoryBySlug,
  listPublicProductsByCategory: mocks.listPublicProductsByCategory,
  listPublicOffers: mocks.listPublicOffers,
  getPublicOfferBySlug: mocks.getPublicOfferBySlug,
}));

import { appRouter } from "../routers";

function store(id: number) {
  return {
    id,
    ownerId: 42,
    name: `store-${id}`,
    slug: `store-${id}`,
    language: "dz-ar",
    templateId: null,
    aiStyleConfig: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function context(activeStore: ReturnType<typeof store> | null): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "store-owner",
      email: "owner@example.com",
      name: "Store Owner",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    store: activeStore,
    storeId: activeStore?.id ?? null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("tenant isolation — public storefront surfaces fail closed without a store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("products.publicList returns [] and never queries a storeless catalog", async () => {
    const list = await appRouter.createCaller(context(null)).products.publicList();
    expect(list).toEqual([]);
    expect(mocks.listPublicStoreProducts).not.toHaveBeenCalled();
  });

  it("products.publicGet refuses with NOT_FOUND before touching the DB", async () => {
    await expect(
      appRouter.createCaller(context(null)).products.publicGet({ id: 7 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicStoreProduct).not.toHaveBeenCalled();
  });

  it("categories.publicList returns [] without a store", async () => {
    const list = await appRouter
      .createCaller(context(null))
      .categories.publicList();
    expect(list).toEqual([]);
    expect(mocks.listPublicCategories).not.toHaveBeenCalled();
  });

  it("categories.publicGet refuses with NOT_FOUND without a store", async () => {
    await expect(
      appRouter.createCaller(context(null)).categories.publicGet({ slug: "x" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicCategoryBySlug).not.toHaveBeenCalled();
  });

  it("offers.publicList returns [] without a store", async () => {
    const list = await appRouter.createCaller(context(null)).offers.publicList();
    expect(list).toEqual([]);
    expect(mocks.listPublicOffers).not.toHaveBeenCalled();
  });

  it("offers.publicGet refuses with NOT_FOUND without a store", async () => {
    await expect(
      appRouter.createCaller(context(null)).offers.publicGet({ slug: "x" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicOfferBySlug).not.toHaveBeenCalled();
  });
});

describe("tenant isolation — lookups are scoped by the caller's store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("products.publicGet scopes by the host store and hides another store's product", async () => {
    // Store B product id resolves to nothing under store A's scope.
    mocks.getPublicStoreProduct.mockResolvedValueOnce(undefined);
    await expect(
      appRouter.createCaller(context(store(7))).products.publicGet({ id: 99 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicStoreProduct).toHaveBeenCalledWith(99, 7);
  });

  it("products.get scopes the dashboard read by the caller's store", async () => {
    mocks.getStoreProductById.mockResolvedValueOnce(undefined);
    await expect(
      appRouter.createCaller(context(store(7))).products.get({ id: 99 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getStoreProductById).toHaveBeenCalledWith(7, 99);
  });

  it("categories.publicGet scopes by host store and hides another store's category", async () => {
    mocks.getPublicCategoryBySlug.mockResolvedValueOnce(undefined);
    await expect(
      appRouter.createCaller(context(store(7))).categories.publicGet({
        slug: "other",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicCategoryBySlug).toHaveBeenCalledWith("other", 7);
    expect(mocks.listPublicProductsByCategory).not.toHaveBeenCalled();
  });

  it("offers.publicGet scopes by host store and hides another store's offer", async () => {
    mocks.getPublicOfferBySlug.mockResolvedValueOnce(undefined);
    await expect(
      appRouter.createCaller(context(store(7))).offers.publicGet({ slug: "other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicOfferBySlug).toHaveBeenCalledWith("other", 7);
  });
});
