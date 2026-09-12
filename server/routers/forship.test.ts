import { describe, expect, it, vi } from "vitest";
import { forshipRouter } from "./forship";

const mocks = vi.hoisted(() => ({
  listStoreShipments: vi.fn(),
  ensureShipmentForOrder: vi.fn(),
  manualRefreshShipment: vi.fn(),
  listCarriers: vi.fn(),
  runAdaptivePolling: vi.fn(),
}));
vi.mock("../forshipDb", () => ({
  listStoreShipments: mocks.listStoreShipments,
  ensureShipmentForOrder: mocks.ensureShipmentForOrder,
  listCarriers: mocks.listCarriers,
}));
vi.mock("../forship", () => ({
  manualRefreshShipment: mocks.manualRefreshShipment,
  runAdaptivePolling: mocks.runAdaptivePolling,
  registerCarrierWebhook: vi.fn(),
}));

const ctx = {
  user: { id: 41 },
  store: {
    id: 7,
    ownerId: 41,
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
} as never;

describe("forship router", () => {
  it("lists shipments for the current store", async () => {
    mocks.listStoreShipments.mockResolvedValue([
      { id: 1, orderId: 5, carrierId: 1, trackingNumber: "T1" },
    ]);
    const caller = forshipRouter.createCaller(ctx);
    await expect(caller.shipments()).resolves.toEqual([
      { id: 1, orderId: 5, carrierId: 1, trackingNumber: "T1" },
    ]);
    expect(mocks.listStoreShipments).toHaveBeenCalledWith(7);
  });

  it("rejects manual refresh for an order the store does not own", async () => {
    mocks.listStoreShipments.mockResolvedValue([]);
    const caller = forshipRouter.createCaller(ctx);
    await expect(caller.refresh({ orderId: 999 })).rejects.toThrow(
      "لا يحتوي على رقم تتبع"
    );
  });

  it("maps manual-refresh rate limiting to a TOO_MANY_REQUESTS error", async () => {
    mocks.listStoreShipments.mockResolvedValue([
      { id: 1, orderId: 5, carrierId: 1, trackingNumber: "T1" },
    ]);
    mocks.manualRefreshShipment.mockRejectedValue(
      new Error("يمكن المزامنة اليدوية مرة واحدة كل دقيقة لنفس الطلب.")
    );
    const caller = forshipRouter.createCaller(ctx);
    await expect(caller.refresh({ orderId: 5 })).rejects.toThrow(
      "يمكن المزامنة اليدوية مرة واحدة كل دقيقة لنفس الطلب."
    );
    expect(mocks.ensureShipmentForOrder).toHaveBeenCalledWith(7, 5);
  });

  it("runs an on-demand adaptive polling sweep", async () => {
    mocks.runAdaptivePolling.mockResolvedValue({
      checked: 3,
      delivered: 1,
      returned: 0,
      failed: 0,
    });
    const caller = forshipRouter.createCaller(ctx);
    await expect(caller.syncNow()).resolves.toEqual({
      checked: 3,
      delivered: 1,
      returned: 0,
      failed: 0,
    });
  });
});
