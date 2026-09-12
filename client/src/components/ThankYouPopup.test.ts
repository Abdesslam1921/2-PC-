import { describe, expect, it } from "vitest";
import { resolveButtonUrl } from "./ThankYouPopup";

describe("ThankYouPopup link handling", () => {
  it("resolves the order number in a tracking link", () => {
    expect(
      resolveButtonUrl(
        "https://tracking.example/orders/{orderNumber}",
        "ABD-000123"
      )
    ).toBe("https://tracking.example/orders/ABD-000123");
  });

  it("keeps the default home link for unsupported protocols", () => {
    expect(resolveButtonUrl("javascript:alert(1)", "ABD-000123")).toBe("/");
  });
});
