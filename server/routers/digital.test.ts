import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  createStoreProduct: vi.fn(),
  listStoreProducts: vi.fn(),
  createDigitalOrder: vi.fn(),
  listDigitalOrders: vi.fn(),
  confirmDigitalOrderPayment: vi.fn(),
  getGoogleOAuthConnection: vi.fn(),
  sendGmailMessage: vi.fn(),
  consumeDigitalDownload: vi.fn(),
  storagePut: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("../db", () => ({
  createStoreProduct: mocks.createStoreProduct,
  listStoreProducts: mocks.listStoreProducts,
  listPublicStoreProducts: vi.fn(),
  getStoreProductById: vi.fn(),
  getPublicStoreProduct: vi.fn(),
  updateStoreProduct: vi.fn(),
  duplicateStoreProduct: vi.fn(),
  deleteStoreProduct: vi.fn(),
  createDigitalOrder: mocks.createDigitalOrder,
  listDigitalOrders: mocks.listDigitalOrders,
  confirmDigitalOrderPayment: mocks.confirmDigitalOrderPayment,
  getGoogleOAuthConnection: mocks.getGoogleOAuthConnection,
  consumeDigitalDownload: mocks.consumeDigitalDownload,
}));
vi.mock("../storage", () => ({
  storagePut: mocks.storagePut,
  storageGetSignedUrl: mocks.storageGetSignedUrl,
}));
vi.mock("../callCenterNotifications", () => ({
  sendGmailMessage: mocks.sendGmailMessage,
}));

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

const digitalInput = {
  title: "دليل التصميم",
  description: "ملف تعليمي رقمي",
  productKind: "digital" as const,
  currency: "EUR",
  status: "active" as const,
  price: "12.50",
  compareAtPrice: "",
  costPerItem: "",
  sku: "GUIDE-01",
  inventory: 0,
  lowStockThreshold: 0,
  trackInventory: false,
  continueSelling: true,
  deliveryPricingMode: "manual" as const,
  media: [],
  variants: [],
  offers: [],
  digitalMaxDownloads: 3,
  digitalLinkValidityHours: 48,
  digitalFile: {
    fileName: "guide.pdf",
    mimeType: "application/pdf",
    size: 5,
    dataUrl: "data:application/pdf;base64,YWFhYWFhYQ==",
  },
};

describe("digital products and offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storagePut.mockResolvedValue({
      key: "digital-products/42/guide.pdf",
      url: "/manus-storage/digital-products/42/guide.pdf",
    });
    mocks.createStoreProduct.mockResolvedValue({
      id: 9,
      title: "دليل التصميم",
      productKind: "digital",
      offers: [],
    });
    mocks.createDigitalOrder.mockResolvedValue({
      id: 101,
      orderNumber: "ABD-000101",
      total: "12.50",
      paymentStatus: "pending",
      orderType: "digital",
    });
    mocks.confirmDigitalOrderPayment.mockResolvedValue({
      orderId: 101,
      orderNumber: "ABD-000101",
      customerEmail: "buyer@example.com",
      links: [
        {
          title: "دليل التصميم",
          url: "/api/downloads/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
          expiresAt: new Date(Date.now() + 3600000),
          maxDownloads: 3,
        },
      ],
    });
    mocks.getGoogleOAuthConnection.mockResolvedValue({
      refreshToken: "encrypted-refresh-token",
      email: "owner@example.com",
    });
    mocks.sendGmailMessage.mockResolvedValue(undefined);
    mocks.consumeDigitalDownload.mockResolvedValue({
      storageKey: "digital-products/42/guide.pdf",
      fileName: "guide.pdf",
      mimeType: "application/pdf",
      remainingDownloads: 2,
    });
    mocks.storageGetSignedUrl.mockResolvedValue(
      "https://signed.example/download"
    );
  });

  it("uploads a digital file and forwards its metadata without delivery fields", async () => {
    const result = await appRouter
      .createCaller(context())
      .products.create(digitalInput);
    expect(mocks.storagePut).toHaveBeenCalledWith(
      expect.stringContaining("digital-products/42/"),
      expect.any(Buffer),
      "application/pdf"
    );
    expect(mocks.createStoreProduct).toHaveBeenCalledWith(
      42,
      7,
      expect.objectContaining({
        productKind: "digital",
        currency: "EUR",
        digitalFileName: "guide.pdf",
        digitalMaxDownloads: 3,
        digitalLinkValidityHours: 48,
        deliveryPricingMode: "fixed",
      })
    );
    expect(result).toMatchObject({ id: 9, productKind: "digital" });
  });

  it("requires a file for a digital product", async () => {
    const { digitalFile: _digitalFile, ...withoutFile } = digitalInput;
    await expect(
      appRouter.createCaller(context()).products.create(withoutFile)
    ).rejects.toThrow("أرفق الملف الرقمي");
    expect(mocks.createStoreProduct).not.toHaveBeenCalled();
  });

  it("keeps the digital order flow pending until owner payment confirmation", async () => {
    const caller = appRouter.createCaller(context());
    const order = await caller.digital.createOrder({
      customerName: "عميل رقمي",
      customerEmail: "buyer@example.com",
      lines: [{ productId: 9, quantity: 1 }],
    });
    const confirmed = await caller.digital.confirmPayment({ orderId: 101 });
    const regenerated = await caller.digital.regenerateLinks({ orderId: 101 });
    const download = await caller.digital.resolveDownload({
      token: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    });
    expect(mocks.createDigitalOrder).toHaveBeenCalledWith(
      {
        customerName: "عميل رقمي",
        customerEmail: "buyer@example.com",
        notes: undefined,
      },
      [{ productId: 9, quantity: 1 }]
    );
    expect(mocks.confirmDigitalOrderPayment).toHaveBeenNthCalledWith(
      1,
      7,
      101,
      false
    );
    expect(mocks.confirmDigitalOrderPayment).toHaveBeenNthCalledWith(
      2,
      7,
      101,
      true
    );
    expect(mocks.consumeDigitalDownload).toHaveBeenCalledOnce();
    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith(
      "digital-products/42/guide.pdf"
    );
    expect(order.paymentStatus).toBe("pending");
    expect(confirmed.links[0].url).toContain("/api/downloads/");
    expect(confirmed.emailStatus).toBe("sent");
    expect(regenerated.links[0].url).toContain("/api/downloads/");
    expect(regenerated.emailStatus).toBe("sent");
    expect(mocks.sendGmailMessage).toHaveBeenCalledTimes(2);
    expect(mocks.sendGmailMessage).toHaveBeenCalledWith(
      "encrypted-refresh-token",
      "owner@example.com",
      "buyer@example.com",
      expect.stringContaining("ABD-000101"),
      expect.stringContaining("/api/downloads/")
    );
    expect(download.signedUrl).toBe("https://signed.example/download");
  });
});
