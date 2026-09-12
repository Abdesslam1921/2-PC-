import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  createStoreProduct: vi.fn(),
  listStoreProducts: vi.fn(),
  listPublicStoreProducts: vi.fn(),
  getStoreProductById: vi.fn(),
  getPublicStoreProduct: vi.fn(),
  updateStoreProduct: vi.fn(),
  duplicateStoreProduct: vi.fn(),
  deleteStoreProduct: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("../db", () => ({
  createStoreProduct: mocks.createStoreProduct,
  listStoreProducts: mocks.listStoreProducts,
  listPublicStoreProducts: mocks.listPublicStoreProducts,
  getStoreProductById: mocks.getStoreProductById,
  getPublicStoreProduct: mocks.getPublicStoreProduct,
  updateStoreProduct: mocks.updateStoreProduct,
  duplicateStoreProduct: mocks.duplicateStoreProduct,
  deleteStoreProduct: mocks.deleteStoreProduct,
}));
vi.mock("../storage", () => ({ storagePut: mocks.storagePut }));

import { appRouter } from "../routers";

function context(): TrpcContext {
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
    store: {
      id: 7,
      ownerId: 42,
      name: "متجر",
      slug: "store",
      language: "dz-ar",
      templateId: null,
      aiStyleConfig: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    storeId: 7,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function validProductInput() {
  return {
    title: "تيشيرت قطني",
    description: "قطن ناعم",
    status: "active" as const,
    price: "3200",
    compareAtPrice: "4000",
    costPerItem: "1800",
    sku: "TS-001",
    inventory: 12,
    lowStockThreshold: 3,
    trackInventory: true,
    continueSelling: false,
    media: [
      {
        id: "media-1",
        fileName: "cotton.jpg",
        dataUrl: "data:image/jpeg;base64,YWFhYWFhYWFhYWFhYWFhYWFhYQ==",
      },
    ],
    variants: [
      {
        color: "أسود",
        size: "M",
        sku: "TS-BLK-M",
        price: "3200",
        compareAtPrice: "4000",
        stock: 4,
        lowStockThreshold: 2,
        mediaId: "media-1",
        available: true,
      },
    ],
  };
}

describe("products.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storagePut.mockResolvedValue({
      key: "products/42/cotton.jpg",
      url: "/manus-storage/products/42/cotton.jpg",
    });
    mocks.createStoreProduct.mockResolvedValue({
      id: 7,
      title: "تيشيرت قطني",
      images: [],
      variants: [],
    });
    mocks.updateStoreProduct.mockResolvedValue({
      id: 7,
      title: "تيشيرت محدّث",
    });
    mocks.duplicateStoreProduct.mockResolvedValue({
      id: 8,
      title: "تيشيرت قطني — نسخة",
    });
    mocks.deleteStoreProduct.mockResolvedValue({ success: true });
    mocks.getPublicStoreProduct.mockResolvedValue({
      id: 7,
      title: "تيشيرت قطني",
      status: "active",
    });
    mocks.listPublicStoreProducts.mockResolvedValue([
      { id: 7, title: "تيشيرت قطني", status: "active" },
    ]);
  });

  it("stores local product data and uploads attached images without using an external catalog", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.products.create(validProductInput());

    expect(mocks.storagePut).toHaveBeenCalledOnce();
    expect(mocks.createStoreProduct).toHaveBeenCalledWith(
      42,
      7,
      expect.objectContaining({
        title: "تيشيرت قطني",
        status: "active",
        media: [
          expect.objectContaining({
            clientId: "media-1",
            url: "/manus-storage/products/42/cotton.jpg",
          }),
        ],
        variants: [
          expect.objectContaining({ color: "أسود", size: "M", stock: 4 }),
        ],
      })
    );
    expect(result).toMatchObject({ id: 7, title: "تيشيرت قطني" });
  });

  it("stops product creation when independent image storage fails", async () => {
    mocks.storagePut.mockRejectedValueOnce(new Error("Storage unavailable"));
    const caller = appRouter.createCaller(context());

    await expect(caller.products.create(validProductInput())).rejects.toThrow(
      "Storage unavailable"
    );
    expect(mocks.createStoreProduct).not.toHaveBeenCalled();
  });

  it("returns the database error after images upload when local product persistence fails", async () => {
    mocks.createStoreProduct.mockRejectedValueOnce(
      new Error("Database unavailable")
    );
    const caller = appRouter.createCaller(context());

    await expect(caller.products.create(validProductInput())).rejects.toThrow(
      "Database unavailable"
    );
    expect(mocks.storagePut).toHaveBeenCalledOnce();
    expect(mocks.createStoreProduct).toHaveBeenCalledOnce();
  });
});

describe("products management actions", () => {
  it("updates, duplicates, deletes, and exposes an active product through its landing query", async () => {
    const caller = appRouter.createCaller(context());
    const { media, variants, ...editable } = validProductInput();

    const updated = await caller.products.update({
      id: 7,
      ...editable,
      title: "تيشيرت محدّث",
    });
    const duplicate = await caller.products.duplicate({ id: 7 });
    const deleted = await caller.products.delete({ id: 7 });
    const landing = await caller.products.publicGet({ id: 7 });
    const publicList = await caller.products.publicList();

    expect(mocks.updateStoreProduct).toHaveBeenCalledWith(
      7,
      7,
      expect.objectContaining({ title: "تيشيرت محدّث", inventory: 12 })
    );
    expect(mocks.duplicateStoreProduct).toHaveBeenCalledWith(7, 7);
    expect(mocks.deleteStoreProduct).toHaveBeenCalledWith(7, 7);
    expect(mocks.getPublicStoreProduct).toHaveBeenCalledWith(7, 7);
    expect(mocks.listPublicStoreProducts).toHaveBeenCalledOnce();
    expect(updated).toMatchObject({ title: "تيشيرت محدّث" });
    expect(duplicate).toMatchObject({ id: 8 });
    expect(deleted).toEqual({ success: true });
    expect(landing).toMatchObject({ id: 7, status: "active" });
    expect(publicList).toEqual([
      { id: 7, title: "تيشيرت قطني", status: "active" },
    ]);
  });
});
