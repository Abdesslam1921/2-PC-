import { describe, expect, it } from "vitest";
import {
  ORDER_DUPLICATE_WINDOW_MS,
  isDuplicateOrderWindow,
  orderLineSignature,
  orderNumberForId,
  shouldReserveInventoryAtCreation,
  shouldRestoreInventory,
} from "./orderConcurrency";

describe("order line signature (double-submit dedupe)", () => {
  it("ignores the cart line order", () => {
    const a = orderLineSignature([
      { productId: 1, quantity: 1, unitPrice: "100.00" },
      { productId: 2, quantity: 2, unitPrice: "50.00" },
    ]);
    const b = orderLineSignature([
      { productId: 2, quantity: 2, unitPrice: "50.00" },
      { productId: 1, quantity: 1, unitPrice: "100.00" },
    ]);
    expect(a).toBe(b);
  });

  it("distinguishes quantity, variant, product and server price", () => {
    const base = { productId: 1, quantity: 1, unitPrice: "100.00" };
    expect(orderLineSignature([{ ...base, quantity: 2 }])).not.toBe(
      orderLineSignature([base])
    );
    expect(orderLineSignature([{ ...base, variantId: 9 }])).not.toBe(
      orderLineSignature([base])
    );
    expect(orderLineSignature([{ ...base, productId: 2 }])).not.toBe(
      orderLineSignature([base])
    );
    expect(orderLineSignature([{ ...base, unitPrice: "90.00" }])).not.toBe(
      orderLineSignature([base])
    );
  });
});

describe("duplicate window", () => {
  it("treats a retry inside the window as a duplicate", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(
      isDuplicateOrderWindow(
        new Date(now.getTime() - ORDER_DUPLICATE_WINDOW_MS + 1),
        now
      )
    ).toBe(true);
    expect(isDuplicateOrderWindow(now, now)).toBe(true);
  });

  it("allows a new order after the window or with a clock skew", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(
      isDuplicateOrderWindow(
        new Date(now.getTime() - ORDER_DUPLICATE_WINDOW_MS - 1),
        now
      )
    ).toBe(false);
    expect(
      isDuplicateOrderWindow(new Date(now.getTime() + 1000), now)
    ).toBe(false);
  });
});

describe("order numbers and inventory lifecycle", () => {
  it("derives a zero-padded, unique public number from the row id", () => {
    expect(orderNumberForId(1)).toBe("ABD-000001");
    expect(orderNumberForId(1234567)).toBe("ABD-1234567");
  });

  it("restores reserved stock for every terminal non-delivered status", () => {
    [
      "returned",
      "cancelled",
      "customer_unresponsive",
      "phone_cancelled",
      "fake",
      "abandoned",
    ].forEach(status => expect(shouldRestoreInventory(status)).toBe(true));
    ["new", "confirmed", "at_carrier", "shipped", "delivered"].forEach(status =>
      expect(shouldRestoreInventory(status)).toBe(false)
    );
  });

  it("reserves stock only for tracked products that do not continue selling", () => {
    expect(
      shouldReserveInventoryAtCreation({
        trackInventory: true,
        continueSelling: false,
      })
    ).toBe(true);
    expect(
      shouldReserveInventoryAtCreation({
        trackInventory: true,
        continueSelling: true,
      })
    ).toBe(false);
    expect(
      shouldReserveInventoryAtCreation({
        trackInventory: false,
        continueSelling: false,
      })
    ).toBe(false);
  });
});
