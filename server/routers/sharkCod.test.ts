import { describe, expect, it } from "vitest";
import { SHARK_COD_EVENT_TYPES, SHARK_COD_MAX_DISCOUNT } from "./sharkCod";

describe("SHARK COD contract", () => {
  it("supports the tracked conversion and rejection events", () => {
    expect(SHARK_COD_EVENT_TYPES).toEqual([
      "view",
      "cta_click",
      "discount_order",
      "reject_price",
      "reject_delivery",
      "reject_compare",
      "reject_hesitate",
      "reject_payment",
      "reject_changed_mind",
    ]);
  });

  it("caps promotional discounts at 90 percent", () => {
    expect(SHARK_COD_MAX_DISCOUNT).toBe(90);
  });
});
