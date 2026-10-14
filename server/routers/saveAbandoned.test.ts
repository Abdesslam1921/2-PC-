import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { resetRateLimits } from "../_core/rateLimit";

const mocks = vi.hoisted(() => ({
  getPublicStoreProduct: vi.fn(),
  getActiveStoreById: vi.fn(),
  upsertAbandonedOrder: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock("../db", () => ({
  getPublicStoreProduct: mocks.getPublicStoreProduct,
  getActiveStoreById: mocks.getActiveStoreById,
  upsertAbandonedOrder: mocks.upsertAbandonedOrder,
}));

vi.mock("../turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}));

import { appRouter } from "../routers";

function context(): TrpcContext {
  return {
    user: null,
    store: null,
    storeId: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const validInput = {
  productId: 9,
  sessionId: "session-123456",
  customerName: "عميل",
  customerPhone: "0550000000",
  wilaya: "الجزائر",
  quantity: 1,
};

describe("orders.saveAbandoned — hardened public endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    mocks.getPublicStoreProduct.mockResolvedValue({ id: 9, storeId: 7 });
    mocks.getActiveStoreById.mockResolvedValue({ id: 7, isActive: true });
    mocks.upsertAbandonedOrder.mockResolvedValue({ saved: true, orderId: 55 });
    mocks.verifyTurnstile.mockResolvedValue(true);
  });

  it("records a legitimate abandoned order for an active product + store", async () => {
    const result = await appRouter
      .createCaller(context())
      .orders.saveAbandoned(validInput);
    expect(result).toEqual({ saved: true, orderId: 55 });
    expect(mocks.upsertAbandonedOrder).toHaveBeenCalledWith({
      productId: 9,
      landingPageId: undefined,
      sessionId: "session-123456",
      customerName: "عميل",
      customerPhone: "0550000000",
      wilaya: "الجزائر",
      municipality: undefined,
      quantity: 1,
    });
  });

  it("ignores a missing product", async () => {
    mocks.getPublicStoreProduct.mockResolvedValue(undefined);
    const result = await appRouter
      .createCaller(context())
      .orders.saveAbandoned(validInput);
    expect(result).toEqual({ saved: false, reason: "store_unavailable" });
    expect(mocks.upsertAbandonedOrder).not.toHaveBeenCalled();
  });

  it("ignores a product whose store is missing or inactive", async () => {
    mocks.getActiveStoreById.mockResolvedValue(undefined);
    const result = await appRouter
      .createCaller(context())
      .orders.saveAbandoned(validInput);
    expect(result).toEqual({ saved: false, reason: "store_unavailable" });
    expect(mocks.upsertAbandonedOrder).not.toHaveBeenCalled();
  });

  it("rejects a malformed phone number without writing", async () => {
    const result = await appRouter.createCaller(context()).orders.saveAbandoned({
      ...validInput,
      customerPhone: "05500",
    });
    expect(result).toEqual({ saved: false, reason: "invalid_phone" });
    expect(mocks.upsertAbandonedOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["0555123456", "0555123456"],
    ["0555 12 34 56", "0555123456"],
    ["0555-12-34-56", "0555123456"],
    ["+213555123456", "0555123456"],
    ["00213555123456", "0555123456"],
    ["555123456", "0555123456"],
  ])("normalises %s to %s before validation", async (raw, expected) => {
    const result = await appRouter
      .createCaller(context())
      .orders.saveAbandoned({ ...validInput, customerPhone: raw });
    expect(result).toEqual({ saved: true, orderId: 55 });
    expect(mocks.upsertAbandonedOrder).toHaveBeenCalledWith(
      expect.objectContaining({ customerPhone: expected })
    );
  });

  it("rejects a non-Algerian-mobile phone number without writing", async () => {
    const result = await appRouter.createCaller(context()).orders.saveAbandoned({
      ...validInput,
      customerPhone: "0212345678",
    });
    expect(result).toEqual({ saved: false, reason: "invalid_phone" });
    expect(mocks.upsertAbandonedOrder).not.toHaveBeenCalled();
  });

  it("reports no_phone when the phone is absent", async () => {
    const result = await appRouter.createCaller(context()).orders.saveAbandoned({
      ...validInput,
      customerPhone: undefined,
    });
    expect(result).toEqual({ saved: false, reason: "no_phone" });
    expect(mocks.upsertAbandonedOrder).not.toHaveBeenCalled();
  });

  it("rate-limits repeated attempts for the same IP + phone + store", async () => {
    const caller = appRouter.createCaller(context());
    for (let i = 0; i < 10; i += 1) {
      const result = await caller.orders.saveAbandoned(validInput);
      expect(result).toEqual({ saved: true, orderId: 55 });
    }
    const blocked = await caller.orders.saveAbandoned(validInput);
    expect(blocked).toEqual({ saved: false, reason: "rate_limited" });
    expect(mocks.upsertAbandonedOrder).toHaveBeenCalledTimes(10);
  });

  it("keeps silent recording working when no Turnstile token is sent", async () => {
    const result = await appRouter
      .createCaller(context())
      .orders.saveAbandoned(validInput);
    expect(result).toEqual({ saved: true, orderId: 55 });
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("rejects when a Turnstile token is sent but fails verification", async () => {
    mocks.verifyTurnstile.mockResolvedValue(false);
    await expect(
      appRouter.createCaller(context()).orders.saveAbandoned({
        ...validInput,
        turnstileToken: "bad-token",
      })
    ).rejects.toThrow("تعذر التحقق من الحماية");
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith(7, "bad-token");
    expect(mocks.upsertAbandonedOrder).not.toHaveBeenCalled();
  });

  it("accepts a valid Turnstile token", async () => {
    const result = await appRouter.createCaller(context()).orders.saveAbandoned({
      ...validInput,
      turnstileToken: "good-token",
    });
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith(7, "good-token");
    expect(result).toEqual({ saved: true, orderId: 55 });
  });
});
