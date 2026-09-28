import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOrders: vi.fn(),
  getCredentials: vi.fn(),
  update: vi.fn(),
  tracking: vi.fn(),
  hasWebhook: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
  listStoreOrders: mocks.listOrders,
  getCarrierCredentials: mocks.getCredentials,
  updateOrderCarrierData: mocks.update,
}));
vi.mock("./ecotrack", () => ({ getEcotrackTrackingInfo: mocks.tracking }));
vi.mock("./forshipDb", () => ({ merchantCarrierHasWebhook: mocks.hasWebhook }));

import { syncStoreEcotrackStatuses } from "./ecotrackSync";

const order = (over: Record<string, unknown> = {}) => ({
  id: 1,
  ownerId: 41,
  storeId: 7,
  carrierTracking: "EC1",
  carrierConnectionId: null,
  fulfillmentStatus: "at_carrier",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCredentials.mockResolvedValue({ apiBaseUrl: "x", token: "t" });
  mocks.update.mockResolvedValue({});
  mocks.hasWebhook.mockResolvedValue(false);
});

describe("syncStoreEcotrackStatuses (hybrid rule)", () => {
  it("applies a different carrier status regardless of a manual final status", async () => {
    mocks.listOrders.mockResolvedValue([
      order({ fulfillmentStatus: "customer_unresponsive" }),
    ]);
    mocks.tracking.mockResolvedValue({ status: "livred" });
    const summary = await syncStoreEcotrackStatuses(7);
    expect(mocks.update).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({ fulfillmentStatus: "delivered" })
    );
    expect(summary.delivered).toBe(1);
  });

  it("keeps the current status when the carrier maps to the same one", async () => {
    mocks.listOrders.mockResolvedValue([
      order({ fulfillmentStatus: "delivered" }),
    ]);
    mocks.tracking.mockResolvedValue({ status: "livred" });
    await syncStoreEcotrackStatuses(7);
    const payload = mocks.update.mock.calls[0][2];
    expect(payload.fulfillmentStatus).toBeUndefined();
    expect(payload.carrierStatus).toBe("livred");
  });

  it("applies the carrier's intermediate status over a manual edit", async () => {
    // The reported bug: manual "confirmed" + carrier "picked" must become at_carrier.
    mocks.listOrders.mockResolvedValue([
      order({ fulfillmentStatus: "confirmed" }),
    ]);
    mocks.tracking.mockResolvedValue({ status: "picked" });
    await syncStoreEcotrackStatuses(7);
    expect(mocks.update).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({ fulfillmentStatus: "at_carrier" })
    );
  });

  it("maps a driver dispatch to shipped", async () => {
    mocks.listOrders.mockResolvedValue([
      order({ fulfillmentStatus: "confirmed" }),
    ]);
    mocks.tracking.mockResolvedValue({ status: "dispatched_to_driver" });
    await syncStoreEcotrackStatuses(7);
    expect(mocks.update).toHaveBeenCalledWith(
      7,
      1,
      expect.objectContaining({ fulfillmentStatus: "shipped" })
    );
  });

  it("keeps the status when the carrier maps to the same store status", async () => {
    mocks.listOrders.mockResolvedValue([
      order({ fulfillmentStatus: "at_carrier" }),
    ]);
    mocks.tracking.mockResolvedValue({ status: "picked" });
    await syncStoreEcotrackStatuses(7);
    const payload = mocks.update.mock.calls[0][2];
    expect(payload.fulfillmentStatus).toBeUndefined();
    expect(payload.carrierStatus).toBe("picked");
  });

  it("auto mode skips final orders", async () => {
    mocks.listOrders.mockResolvedValue([
      order({ id: 1, fulfillmentStatus: "delivered" }),
      order({ id: 2, fulfillmentStatus: "at_carrier" }),
    ]);
    mocks.tracking.mockResolvedValue({ status: "picked" });
    await syncStoreEcotrackStatuses(7, {
      includeFinal: false,
      skipWebhookCarriers: true,
    });
    expect(mocks.tracking).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][1]).toBe(2);
  });

  it("auto mode skips carriers that push webhooks", async () => {
    mocks.listOrders.mockResolvedValue([order()]);
    mocks.hasWebhook.mockResolvedValue(true);
    const summary = await syncStoreEcotrackStatuses(7, {
      includeFinal: false,
      skipWebhookCarriers: true,
    });
    expect(mocks.tracking).not.toHaveBeenCalled();
    expect(summary.synced).toBe(0);
  });
});
