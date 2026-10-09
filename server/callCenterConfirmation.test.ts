import { describe, expect, it } from "vitest";
import {
  confirmationCostCentsForOrder,
  hasDefinedCommission,
  shouldSnapshotAgentConfirmation,
} from "./callCenterConfirmation";

describe("Call Center confirmation cost snapshot", () => {
  it("treats a positive general or completed rate as a defined commission", () => {
    expect(hasDefinedCommission("125.50", "0.00")).toBe(true);
    expect(hasDefinedCommission("0.00", "200.00")).toBe(true);
    expect(hasDefinedCommission("0.00", "0.00")).toBe(false);
    expect(hasDefinedCommission(null, undefined)).toBe(false);
  });

  it("snapshots on confirmed and later statuses, once, even if confirmed is skipped", () => {
    expect(
      shouldSnapshotAgentConfirmation({
        nextStatus: "confirmed",
        alreadyCallCenter: false,
      })
    ).toBe(true);
    expect(
      shouldSnapshotAgentConfirmation({
        nextStatus: "at_carrier",
        alreadyCallCenter: false,
      })
    ).toBe(true);
    expect(
      shouldSnapshotAgentConfirmation({
        nextStatus: "review",
        alreadyCallCenter: false,
      })
    ).toBe(false);
    expect(
      shouldSnapshotAgentConfirmation({
        nextStatus: "cancelled",
        alreadyCallCenter: false,
      })
    ).toBe(false);
  });

  it("does not rewrite a snapshot that was already taken", () => {
    expect(
      shouldSnapshotAgentConfirmation({
        nextStatus: "processing",
        alreadyCallCenter: true,
      })
    ).toBe(false);
  });

  it("counts confirmation cost once for a multi-item order", () => {
    const items = [
      {
        confirmationSource: "call_center" as const,
        normalConfirmationCostSnapshot: "80.00",
        deliveredConfirmationCostSnapshot: "120.00",
      },
      {
        confirmationSource: "call_center" as const,
        normalConfirmationCostSnapshot: "80.00",
        deliveredConfirmationCostSnapshot: "120.00",
      },
    ];
    expect(confirmationCostCentsForOrder(items, false)).toBe(8000);
    expect(confirmationCostCentsForOrder(items, true)).toBe(12000);
  });

  it("charges nothing when the source is owner or the agent has no commission", () => {
    expect(
      confirmationCostCentsForOrder(
        [
          {
            confirmationSource: "owner",
            normalConfirmationCostSnapshot: "0.00",
            deliveredConfirmationCostSnapshot: "0.00",
          },
        ],
        false
      )
    ).toBe(0);
  });
});
