import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  computeShipmentUpdate,
  ECOTRACK_STATUS_MAP,
  intervalFor,
  NO_CHANGE_INTERVAL_MS,
  parseWebhookPayload,
  UNKNOWN_MAPPING,
  verifyWebhookSignature,
} from "./forshipCore";
import type { OrderShipment } from "../drizzle/schema";

function shipment(
  overrides: Partial<OrderShipment> = {}
): Pick<
  OrderShipment,
  "externalStatusLabel" | "statusEnteredAt" | "syncMethod" | "reviewFlagged"
> {
  return {
    externalStatusLabel: null,
    statusEnteredAt: null,
    syncMethod: "polling",
    reviewFlagged: false,
    ...overrides,
  };
}

describe("forship core — shared update function", () => {
  it("maps a final delivered label and fires the delivered event with next_check cleared", () => {
    const result = computeShipmentUpdate(
      shipment(),
      "livred",
      ECOTRACK_STATUS_MAP.livred,
      new Date("2026-09-07T12:00:00Z")
    );
    expect(result.changed).toBe(true);
    expect(result.externalStatusLabel).toBe("livred");
    expect(result.finalStatus).toBe("delivered");
    expect(result.resolvedAt).not.toBeNull();
    expect(result.nextCheckAt).toBeNull();
    expect(result.event).toBe("delivered");
    expect(result.historyEntry).toEqual({
      label: "livred",
      at: "2026-09-07T12:00:00.000Z",
    });
  });

  it("maps a final returned label", () => {
    const result = computeShipmentUpdate(
      shipment(),
      "return_received",
      ECOTRACK_STATUS_MAP.return_received,
      new Date()
    );
    expect(result.finalStatus).toBe("returned");
    expect(result.event).toBe("returned");
    expect(result.nextCheckAt).toBeNull();
  });

  it("keeps webhook shipments at next_check=null for non-final transitions", () => {
    const result = computeShipmentUpdate(
      shipment({ syncMethod: "webhook" }),
      "dispatched_to_driver",
      ECOTRACK_STATUS_MAP.dispatched_to_driver,
      new Date()
    );
    expect(result.changed).toBe(true);
    expect(result.finalStatus).toBeNull();
    expect(result.event).toBeNull();
    expect(result.nextCheckAt).toBeNull();
  });

  it("schedules the adaptive interval for polling shipments", () => {
    const now = new Date("2026-09-07T12:00:00Z");
    const result = computeShipmentUpdate(
      shipment(),
      "dispatched_to_driver",
      ECOTRACK_STATUS_MAP.dispatched_to_driver,
      now
    );
    expect(result.nextCheckAt?.getTime()).toBe(
      now.getTime() + intervalFor("out_for_delivery")
    );
  });

  it("returns no-change without an event", () => {
    const result = computeShipmentUpdate(
      shipment({ externalStatusLabel: "picked", statusEnteredAt: new Date() }),
      "picked",
      ECOTRACK_STATUS_MAP.picked,
      new Date()
    );
    expect(result.changed).toBe(false);
    expect(result.event).toBeNull();
    expect(result.historyEntry).toBeNull();
  });

  it("flags a shipment that has not changed for more than 5 days and deprioritizes it", () => {
    const now = new Date();
    const result = computeShipmentUpdate(
      shipment({
        externalStatusLabel: "accepted_by_carrier",
        statusEnteredAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      }),
      "accepted_by_carrier",
      ECOTRACK_STATUS_MAP.accepted_by_carrier,
      now
    );
    expect(result.changed).toBe(false);
    expect(result.reviewFlagged).toBe(true);
    expect(result.nextCheckAt?.getTime()).toBe(
      now.getTime() + NO_CHANGE_INTERVAL_MS
    );
  });

  it("falls back to unknown mapping for unrecognized raw labels", () => {
    const result = computeShipmentUpdate(
      shipment(),
      "totally_new_label",
      UNKNOWN_MAPPING,
      new Date()
    );
    expect(result.changed).toBe(true);
    expect(result.externalStatusLabel).toBe("totally_new_label");
    expect(result.finalStatus).toBeNull();
  });
});

describe("forship core — adaptive intervals", () => {
  it("uses short intervals for out_for_delivery and long ones for suspended", () => {
    expect(intervalFor("out_for_delivery")).toBe(20 * 60 * 1000);
    expect(intervalFor("suspended")).toBe(6 * 60 * 60 * 1000);
    expect(intervalFor("in_transit")).toBe(5 * 60 * 60 * 1000);
  });
});

describe("forship core — webhook payload + signature", () => {
  it("extracts flat tracking + status", () => {
    expect(
      parseWebhookPayload({ tracking_number: "ABC123", status: "livred" })
    ).toEqual({ trackingNumber: "ABC123", rawLabel: "livred" });
  });

  it("extracts camelCase nested data", () => {
    expect(
      parseWebhookPayload({
        data: { trackingNumber: "X-9", rawLabel: "En Livraison" },
      })
    ).toEqual({ trackingNumber: "X-9", rawLabel: "En Livraison" });
  });

  it("returns null for missing fields", () => {
    expect(parseWebhookPayload({ foo: "bar" })).toBeNull();
    expect(parseWebhookPayload(null)).toBeNull();
  });

  it("verifies an HMAC signature and rejects a wrong one", () => {
    const body = JSON.stringify({
      tracking_number: "ABC123",
      status: "livred",
    });
    const expected = createHmac("sha256", "secret").update(body).digest("hex");
    expect(
      verifyWebhookSignature(
        "secret",
        { "x-forship-signature": expected },
        body
      )
    ).toBe(true);
    expect(
      verifyWebhookSignature(
        "secret",
        { "x-forship-signature": "deadbeef" },
        body
      )
    ).toBe(false);
  });

  it("skips verification when no secret is configured", () => {
    expect(verifyWebhookSignature(null, {}, "{}")).toBe(true);
  });
});
