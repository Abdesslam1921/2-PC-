import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  listCategoriesWithCounts: vi.fn(),
  createCategory: vi.fn(),
  getCategoryById: vi.fn(),
  updateCategory: vi.fn(),
  countCategoryProducts: vi.fn(),
  deleteCategory: vi.fn(),
  setCategoryOrder: vi.fn(),
  listPublicCategories: vi.fn(),
  getPublicCategoryBySlug: vi.fn(),
  listPublicProductsByCategory: vi.fn(),
}));

vi.mock("../db", () => ({
  listCategoriesWithCounts: mocks.listCategoriesWithCounts,
  createCategory: mocks.createCategory,
  getCategoryById: mocks.getCategoryById,
  updateCategory: mocks.updateCategory,
  countCategoryProducts: mocks.countCategoryProducts,
  deleteCategory: mocks.deleteCategory,
  setCategoryOrder: mocks.setCategoryOrder,
  listPublicCategories: mocks.listPublicCategories,
  getPublicCategoryBySlug: mocks.getPublicCategoryBySlug,
  listPublicProductsByCategory: mocks.listPublicProductsByCategory,
}));

type Store = { id: number; ownerId: number } | null;

function makeContext(store: Store, withUser = true): TrpcContext {
  return {
    user: withUser
      ? ({
          id: store?.ownerId ?? 42,
          openId: "owner-open-id",
          name: "Owner",
          email: "owner@example.com",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext["user"])
      : null,
    store: store ? { id: store.id } : null,
    req: { headers: {}, protocol: "https", hostname: "localtest.me" },
    res: {},
  } as unknown as TrpcContext;
}

describe("categories.publicList / publicGet — fail-closed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty list with no resolved store (never every store's rows)", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.categories.publicList()).resolves.toEqual([]);
    expect(mocks.listPublicCategories).not.toHaveBeenCalled();
  });

  it("refuses a category page with no resolved store", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(
      caller.categories.publicGet({ slug: "clothes" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicCategoryBySlug).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for an unknown or inactive slug", async () => {
    mocks.getPublicCategoryBySlug.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    await expect(
      caller.categories.publicGet({ slug: "hidden" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getPublicCategoryBySlug).toHaveBeenCalledWith("hidden", 30001);
  });

  it("scopes the slug lookup to the resolved store (tenant isolation)", async () => {
    mocks.getPublicCategoryBySlug.mockResolvedValueOnce({
      id: 5,
      name: "ملابس",
      slug: "clothes",
      imageUrl: null,
    });
    mocks.listPublicProductsByCategory.mockResolvedValueOnce([{ id: 1, title: "منتج" }]);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    const result = await caller.categories.publicGet({ slug: "clothes" });
    expect(mocks.getPublicCategoryBySlug).toHaveBeenCalledWith("clothes", 30001);
    expect(mocks.listPublicProductsByCategory).toHaveBeenCalledWith(5, 30001);
    expect(result.category.slug).toBe("clothes");
    expect(result.products).toHaveLength(1);
  });

  it("lists active categories only for the resolved store", async () => {
    mocks.listPublicCategories.mockResolvedValueOnce([{ id: 1, slug: "clothes" }]);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    await caller.categories.publicList();
    expect(mocks.listPublicCategories).toHaveBeenCalledWith(30001);
  });
});

describe("categories dashboard operations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an active store", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.categories.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("generates an Arabic-friendly slug from the name", async () => {
    mocks.createCategory.mockResolvedValueOnce(9);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    const result = await caller.categories.create({ name: "ملابس رجالية" });
    expect(result.slug).toBe("ملابس-رجالية");
    expect(mocks.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 30001,
        ownerId: 7,
        name: "ملابس رجالية",
        slug: "ملابس-رجالية",
      })
    );
  });

  it("reports a duplicate slug as CONFLICT", async () => {
    mocks.createCategory.mockRejectedValueOnce(new Error("Duplicate entry"));
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    await expect(
      caller.categories.create({ name: "ملابس" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never updates a category of another store", async () => {
    mocks.getCategoryById.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    await expect(
      caller.categories.update({ id: 99, name: "x" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.updateCategory).not.toHaveBeenCalled();
  });

  it("blocks deleting a category that still has products", async () => {
    mocks.getCategoryById.mockResolvedValueOnce({ id: 5, storeId: 30001 });
    mocks.countCategoryProducts.mockResolvedValueOnce(3);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    await expect(caller.categories.remove({ id: 5 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
  });

  it("deletes an empty category", async () => {
    mocks.getCategoryById.mockResolvedValueOnce({ id: 5, storeId: 30001 });
    mocks.countCategoryProducts.mockResolvedValueOnce(0);
    mocks.deleteCategory.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    await expect(caller.categories.remove({ id: 5 })).resolves.toEqual({ ok: true });
    expect(mocks.deleteCategory).toHaveBeenCalledWith(30001, 5);
  });

  it("reorders only within the caller's store", async () => {
    mocks.setCategoryOrder.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeContext({ id: 30001, ownerId: 7 }));
    await caller.categories.reorder({ ids: [3, 1, 2] });
    expect(mocks.setCategoryOrder).toHaveBeenCalledWith(30001, [3, 1, 2]);
  });
});
