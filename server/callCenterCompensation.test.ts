import { describe, expect, it } from "vitest";
import { calculatePerOrderCompensation } from "./callCenterDb";

describe("Call Center compensation", () => {
  it("calculates the general rate once for every confirmed order", () => {
    expect(calculatePerOrderCompensation("all_orders", "125.50", 4, 2)).toEqual(
      {
        eligibleOrders: 4,
        rate: "125.50",
        estimatedCompensation: "502.00",
        unit: "per_order",
      }
    );
  });

  it("calculates the completed-only rate once for every delivered order", () => {
    expect(
      calculatePerOrderCompensation("completed_orders", "200.00", 7, 3)
    ).toEqual({
      eligibleOrders: 3,
      rate: "200.00",
      estimatedCompensation: "600.00",
      unit: "per_order",
    });
  });
});
